package llm_proxy

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"github.com/cockroachdb/errors"
	"io"
	"llmmask/src/auth"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/log"
	"llmmask/src/models"
	"llmmask/src/secrets"
	"maps"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const MaxRequestSizeBytes = 250000 // 250KB limit for LLM proxy requests

// LLMProxy will be responsible for proxying requests, and also all the bookkeeping related to them.
// This is needed to stop replay attacks, and also stop wastage of tokens in case of network errors.
type LLMProxy struct {
	apiKeyManager    *APIKeyManager
	authManagers     map[confs.ModelName]*auth.AuthManager
	abuseAuthManager *auth.AbuseAuthManager
	dbHandler        *models.DBHandler
	contentModerator *ContentModerator
	kms              *secrets.AzureKMS
}

func NewLLMProxy(authManagers map[confs.ModelName]*auth.AuthManager, abuseAuthManager *auth.AbuseAuthManager, apiKeyManager *APIKeyManager, dbHandler *models.DBHandler,
	contentModerator *ContentModerator, kms *secrets.AzureKMS) *LLMProxy {
	return &LLMProxy{
		authManagers:     authManagers,
		abuseAuthManager: abuseAuthManager,
		apiKeyManager:    apiKeyManager,
		dbHandler:        dbHandler,
		contentModerator: contentModerator,
		kms:              kms,
	}
}

// ServeRequest does the required proxying with auth.
// PROXY DESIGN:
// OpenAI API calls are made. Since most of the vendors support this,
// this way clients only need to send data in 1 format.
// In extra_body.llmmask we have the required token info.
func (l *LLMProxy) ServeRequest(r *http.Request) (*LLMProxyResponse, error) {
	ctx := r.Context()
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}

	// Check request size limit
	// TODO: Multi-credit support for large requests and reasoning models.
	// Two cases require consuming more than one blind token per request:
	//   1. Large context inputs: requests >100KB should cost 2 credits, >200KB should cost 3 credits.
	//      This prevents users from sending max-size (300KB, ~75K tokens) requests at single-credit price.
	//   2. Reasoning models (o1, gemini-3-pro, etc.): these silently generate large numbers of internal
	//      reasoning/thinking tokens that are billed by the upstream but invisible in the request body.
	//      A single o1 request can cost 10–30x a normal request. Require a fixed credit multiplier
	//      (e.g. 3–5 credits) for any reasoning model, enforced here before token verification.
	// Until this is implemented, reasoning models and preview models are disabled in AllModels().
	if len(bodyBytes) > MaxRequestSizeBytes {
		return &LLMProxyResponse{
			SizeLimitExceeded: true,
			SizeLimitReason:   "",
		}, nil
	}

	var bodyMap map[string]any
	err = json.Unmarshal(bodyBytes, &bodyMap)
	if err != nil {
		return nil, err
	}

	extraBody_ := bodyMap["extra_body"]
	extraBody := extraBody_.(map[string]any)
	llmmaskData := extraBody["llmmask"]
	delete(extraBody, "llmmask") // Drop this from going to any vendor.
	bodyMap["extra_body"] = extraBody
	CleanProxyRequest(bodyMap)

	proxyReqBody, err := json.Marshal(bodyMap)
	if err != nil {
		return nil, err
	}

	llmmaskDataBytes, err := json.Marshal(llmmaskData)
	if err != nil {
		return nil, err
	}
	req := &LLMProxyExtraBodyReq{}
	err = json.Unmarshal(llmmaskDataBytes, req)
	if err != nil {
		return nil, err
	}

	// NOTE: We wanna prefer doing as much parsing as possible before putting load on our auth state.
	err = req.Sanitize()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to sanitize proxy request")
	}

	intendedModel := req.ModelName
	ok, err := DoesRequestHasIntendedModel(intendedModel, bodyMap)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.Newf("model in request body mismatch, expected %s", intendedModel)
	}

	authManager, ok := l.authManagers[intendedModel]
	if !ok {
		return nil, errors.New("no auth manager for intended model")
	}
	apiKey, err := l.apiKeyManager.GetAPIKeyForModel(ctx, intendedModel)
	if err != nil {
		return nil, err
	}

	destURLStr, err := l.apiKeyManager.GetEndpointForModel(intendedModel)
	if err != nil {
		return nil, err
	}
	destURL, err := url.Parse(destURLStr)
	if err != nil {
		return nil, err
	}

	// Verify permanent abuse token
	if err := l.abuseAuthManager.VerifyPermanentToken(req.PermanentAbuseToken, req.PermanentAbuseTokenSig); err != nil {
		return &LLMProxyResponse{AbuseTokenInvalid: true}, nil
	}
	// Check permanent abuse token not blacklisted — fail closed on DB error
	permBlacklist := &models.AbuseTokenBlacklist{
		DocID: models.DocIDForAbuseToken(req.PermanentAbuseToken),
	}
	permFetchErr := l.dbHandler.Fetch(ctx, permBlacklist)
	if permFetchErr == nil {
		return &LLMProxyResponse{AbuseTokenBlacklisted: true}, nil
	}
	if !models.IsNotFoundErr(permFetchErr) {
		return nil, errors.Wrapf(permFetchErr, "failed to check permanent abuse token blacklist")
	}

	// Verify transient abuse token
	transientErr := l.abuseAuthManager.VerifyTransientToken(req.TransientAbuseToken, req.TransientAbuseTokenSig)
	if transientErr != nil {
		if errors.Is(transientErr, auth.ErrAbuseTokenExpired) {
			return &LLMProxyResponse{AbuseTokenExpired: true}, nil
		}
		return &LLMProxyResponse{AbuseTokenInvalid: true}, nil
	}
	// Check transient abuse token not blacklisted — fail closed on DB error
	transBlacklist := &models.AbuseTokenBlacklist{
		DocID: models.DocIDForAbuseToken(req.TransientAbuseToken),
	}
	transFetchErr := l.dbHandler.Fetch(ctx, transBlacklist)
	if transFetchErr == nil {
		return &LLMProxyResponse{AbuseTokenBlacklisted: true}, nil
	}
	if !models.IsNotFoundErr(transFetchErr) {
		return nil, errors.Wrapf(transFetchErr, "failed to check transient abuse token blacklist")
	}

	isTokenValid, err := authManager.VerifyUnBlindedToken(req.Token, req.SignedToken)
	if err != nil {
		return nil, err
	}
	if !isTokenValid {
		return nil, errors.Newf("invalid token for model %s", intendedModel)
	}

	semConf := &common.SemaphoreConf{
		Handle:  "auth-token-" + hex.EncodeToString(req.Token),
		Request: 1,
		Limit:   1,
	}
	err = common.AcquireSemaphore(ctx, semConf)
	if err != nil {
		return nil, err
	}
	defer common.ReleaseSemaphore(semConf)

	tokenDocID := models.DocIDForAuthToken(req.Token)
	authToken := &models.AuthToken{
		DocID: tokenDocID,
	}
	isFirstReq := false
	err = l.dbHandler.Fetch(ctx, authToken)
	if err != nil {
		if !models.IsNotFoundErr(err) {
			return nil, err
		}
		isFirstReq = true
		reqHash := sha256.Sum256(req.Bytes())
		authToken = &models.AuthToken{
			DocID:          tokenDocID,
			ModelName:      intendedModel,
			CreatedAt:      time.Now().UTC(),
			ExpiresAt:      time.Now().UTC().Add(time.Hour * 24 * 5),
			RequestHash:    reqHash[:],
			CachedResponse: nil,
		}
	}

	if authToken.ExpiresAt.Before(time.Now().UTC()) {
		return nil, errors.New("token expired, this token was already used, and any cached response  is not available.")
	}
	if !isFirstReq { // Avoid recomputing
		reqHash := sha256.Sum256(req.Bytes())
		// TODO: constant time comparision needed? probably not.
		if !bytes.Equal(authToken.RequestHash, reqHash[:]) {
			return nil, errors.New("cannot reuse token for different request.")
		}
	}
	if authToken.CachedResponse != nil {
		cachedRespWrapped := authToken.CachedResponse
		dekWrapped := authToken.DEKWrapped
		kmsKeyID := authToken.DEKKMSKeyID

		dek, err := l.kms.Decrypt(ctx, string(dekWrapped), kmsKeyID)
		if err != nil {
			return nil, err
		}
		respPT, err := secrets.DecryptAES(string(cachedRespWrapped), string(dek))
		if err != nil {
			return nil, err
		}
		resp := &LLMProxyResponse{}
		err = json.Unmarshal([]byte(respPT), resp)
		log.Infof(ctx, "cache hit for llm proxy")
		return resp, err
	}

	// Content Moderation:
	analyzeResp, err := l.contentModerator.AnalyzeGPTReq(ctx, proxyReqBody)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to analyze text")
	}
	isOffensive := false
	for _, analysis := range analyzeResp.CategoriesAnalysis {
		if analysis.Severity > confs.MaxOffensiveContentSeverity(ctx) {
			isOffensive = true
		}
	}

	resp := &LLMProxyResponse{}
	if isOffensive {
		resp = &LLMProxyResponse{
			IsBlocked:     true,
			BlockedReason: string(common.Must(json.Marshal(analyzeResp.CategoriesAnalysis))),
		}
		log.Infof(ctx, "Blocked due to offensive")
	} else {
		proxyReqBody, apiKind, err := TransformProxyReqBody(intendedModel, proxyReqBody)
		if err != nil {
			return nil, err
		}
		switch apiKind {
		case apiKindOpenAIResponses:
			// Switch the endpoint from /chat/completions to /responses.
			destURL.Path = strings.Replace(destURL.Path, "/chat/completions", "/responses", 1)
		case apiKindGeminiNative:
			// Switch from the OpenAI-compat path to the native generateContent path.
			destURL.Path = strings.Replace(destURL.Path, "/openai/chat/completions", "/models/"+string(intendedModel)+":generateContent", 1)
		}
		reqFwd := &http.Request{
			Method: "POST",
			URL:    destURL,
			Header: make(http.Header), // Never forward client headers; set only what the upstream needs.
			Body:   io.NopCloser(bytes.NewReader(proxyReqBody)),
		}
		reqFwd = reqFwd.WithContext(ctx)

		switch intendedModel {
		case confs.ModelGemini25Flash, confs.ModelGemini25Pro, confs.ModelGemini25FlashLite, confs.ModelGemini3Flash, confs.ModelGemini3Pro:
			reqFwd.Header.Set("x-goog-api-key", apiKey.UnsafeString())
			// Native generateContent uses x-goog-api-key only; OpenAI-compat also accepted Bearer but
			// the native endpoint rejects it with UNAUTHENTICATED / ACCESS_TOKEN_TYPE_UNSUPPORTED.
			reqFwd.Header.Set("content-type", "application/json")
			// TODO: Removing gzip for now, use it later.
			reqFwd.Header.Set("Accept-Encoding", "identity")
		case confs.ModelChatGPT41Mini, confs.ModelChatGPT41, confs.ModelChatGPT4o, confs.ModelChatGPTo1,
			confs.ModelChatGPT53, confs.ModelChatGPT5Mini:
			reqFwd.Header.Set("Authorization", "Bearer "+apiKey.UnsafeString())
			reqFwd.Header.Set("content-type", "application/json")
			// TODO: Removing gzip for now, use it later.
			reqFwd.Header.Set("Accept-Encoding", "identity")
		}

		proxyResp, err := http.DefaultClient.Do(reqFwd)
		if err != nil {
			return nil, err
		}

		proxyRespBytes, err := io.ReadAll(proxyResp.Body)
		if err != nil {
			return nil, err
		}
		err = proxyResp.Body.Close()
		if err != nil {
			return nil, err
		}

		switch apiKind {
		case apiKindOpenAIResponses:
			if proxyResp.StatusCode != http.StatusOK {
				log.Infof(ctx, "responses API returned non-200 status=%d", proxyResp.StatusCode)
			} else {
				proxyRespBytes, err = convertFromResponsesAPI(proxyRespBytes)
				if err != nil {
					return nil, errors.Wrapf(err, "failed to convert responses API response")
				}
			}
		case apiKindGeminiNative:
			if proxyResp.StatusCode != http.StatusOK {
				log.Infof(ctx, "gemini native API returned non-200 status=%d", proxyResp.StatusCode)
			} else {
				proxyRespBytes, err = convertFromGeminiNative(proxyRespBytes, string(intendedModel))
				if err != nil {
					return nil, errors.Wrapf(err, "failed to convert gemini native response")
				}
			}
		}

		resp = &LLMProxyResponse{
			Metadata:      []byte("lgtm"),
			ProxyResponse: proxyRespBytes,
		}
	}

	// Save the Cached Response with encryption.
	{
		dekPT, err := secrets.NewRandomAESKey()
		if err != nil {
			return nil, err
		}
		cachedRespPT := resp.Bytes()
		cachedRespWrapped, err := secrets.EncryptAES(string(cachedRespPT), string(dekPT))
		if err != nil {
			return nil, err
		}

		dekWrapped, kmsKeyID, err := l.kms.Encrypt(ctx, dekPT)
		if err != nil {
			return nil, err
		}

		authToken.CachedResponse = []byte(cachedRespWrapped)
		authToken.DEKWrapped = []byte(dekWrapped)
		authToken.DEKKMSKeyID = kmsKeyID
	}
	err = l.dbHandler.Upsert(ctx, authToken)
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func DoesRequestHasIntendedModel(intendedModel confs.ModelName, req map[string]any) (bool, error) {
	modelName := req["model"].(string)
	return modelName == intendedModel, nil
}

func CleanProxyRequest(req map[string]any) {
	keys := maps.Keys(req)
	for key := range keys {
		if key != "model" && key != "messages" {
			delete(req, key)
		}
	}
}

type proxyAPIKind int

const (
	apiKindChatCompletions proxyAPIKind = iota // passthrough — no conversion
	apiKindOpenAIResponses                     // OpenAI Responses API (/v1/responses)
	apiKindGeminiNative                        // Gemini generateContent native API
)

// TransformProxyReqBody converts the request body to the appropriate upstream format.
func TransformProxyReqBody(modelName string, proxyReqBody []byte) (body []byte, kind proxyAPIKind, err error) {
	if isOpenAIModel(modelName) {
		converted, convErr := convertToResponsesAPI(proxyReqBody)
		if convErr != nil {
			return nil, apiKindChatCompletions, convErr
		}
		return converted, apiKindOpenAIResponses, nil
	}
	if isGeminiModel(modelName) {
		converted, convErr := convertToGeminiNative(proxyReqBody)
		if convErr != nil {
			return nil, apiKindChatCompletions, convErr
		}
		return converted, apiKindGeminiNative, nil
	}
	return proxyReqBody, apiKindChatCompletions, nil
}
