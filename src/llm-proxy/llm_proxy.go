package llm_proxy

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"github.com/cockroachdb/errors"
	"io"
	"llmmask/src/auth"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/log"
	"llmmask/src/models"
	"net/http"
	"net/url"
	"time"
)

// LLMProxy will be responsible for proxying requests, and also all the bookkeeping related to them.
// This is needed to stop replay attacks, and also stop wastage of tokens in case of network errors.
type LLMProxy struct {
	apiKeyManager *APIKeyManager
	authManagers  map[confs.ModelName]*auth.AuthManager
	dbHandler     *models.DBHandler
}

func NewLLMProxy(authManagers map[confs.ModelName]*auth.AuthManager, apiKeyManager *APIKeyManager, dbHandler *models.DBHandler) *LLMProxy {
	return &LLMProxy{
		authManagers:  authManagers,
		apiKeyManager: apiKeyManager,
		dbHandler:     dbHandler,
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

	var bodyMap map[string]any
	err = json.Unmarshal(bodyBytes, &bodyMap)
	if err != nil {
		return nil, err
	}

	log.Infof(ctx, "body: %s", string(bodyBytes))

	extraBody_ := bodyMap["extra_body"]
	extraBody := extraBody_.(map[string]any)
	llmmaskData := extraBody["llmmask"]
	delete(extraBody, "llmmask") // Drop this from going to any vendor.
	bodyMap["extra_body"] = extraBody

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

	log.Infof(ctx, "proxy req: %s", string(proxyReqBody))

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

	tokenDocID := base64.StdEncoding.EncodeToString(req.Token)
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
		reqHash := md5.Sum(req.Bytes())
		authToken = &models.AuthToken{
			DocID:          tokenDocID,
			ModelName:      intendedModel,
			CreatedAt:      time.Now().UTC(),
			ExpiresAt:      time.Now().UTC().Add(time.Minute * 5),
			RequestHash:    reqHash[:],
			CachedResponse: nil,
		}
	}

	if authToken.ExpiresAt.Before(time.Now().UTC()) {
		return nil, errors.New("token expired")
	}
	if !isFirstReq { // Avoid recomputing
		reqHash := md5.Sum(req.Bytes())
		// TODO: constant time comparision needed? probably not.
		if !bytes.Equal(authToken.RequestHash, reqHash[:]) {
			return nil, errors.New("cannot reuse token for different request.")
		}
	}
	if authToken.CachedResponse != nil {
		resp := &LLMProxyResponse{}
		err = json.Unmarshal(authToken.CachedResponse, resp)
		return resp, err
	}

	reqFwd := &http.Request{
		Method: "POST",
		URL:    destURL,
		Header: r.Header,
		Body:   io.NopCloser(bytes.NewReader(proxyReqBody)),
	}
	reqFwd = reqFwd.WithContext(ctx)

	switch intendedModel {
	case confs.ModelGemini25Flash:
		reqFwd.Header.Set("x-goog-api-key", apiKey.UnsafeString())
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
	resp := &LLMProxyResponse{
		Metadata:      []byte("lgtm"),
		ProxyResponse: proxyRespBytes,
	}
	authToken.CachedResponse = resp.Bytes()
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
