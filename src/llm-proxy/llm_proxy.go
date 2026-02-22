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
	"time"
)

const MaxRequestSizeBytes = 30000 // 30KB limit for LLM proxy requests

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
	// TODO: Large requests with multiple credits
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

	destURLStr := DestURLForModel(intendedModel)
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
		proxyReqBody, err = TransformProxyReqBody(intendedModel, proxyReqBody)
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
			reqFwd.Header.Set("Authorization", "Bearer "+apiKey.UnsafeString())
			reqFwd.Header.Set("content-type", "application/json")
			// TODO: Removing gzip for now, use it later.
			reqFwd.Header.Set("Accept-Encoding", "identity")
		case confs.ModelChatGPT41Mini, confs.ModelChatGPT41, confs.ModelChatGPT4o, confs.ModelChatGPTo1:
			//reqFwd.Header.Set("x-goog-api-key", apiKey.UnsafeString())
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

func TransformProxyReqBody(modelName string, proxyReqBody []byte) ([]byte, error) {
	return proxyReqBody, nil
}
