package llm_proxy

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
	"google.golang.org/grpc/status"
	"io"
	"llmmask/src/auth"
	"llmmask/src/common"
	"llmmask/src/models"
	"net/http"
	"net/url"
	"time"
)

type ModelName = string

const (
	ModelGemini25Flash = "gemini-2.5-flash"
)

// LLMProxy will be responsible for proxying requests, and also all the bookkeeping related to them.
// This is needed to stop replay attacks, and also stop wastage of tokens in case of network errors.
type LLMProxy struct {
	apiKeyManager *APIKeyManager
	authManagers  map[ModelName]*auth.AuthManager
}

func NewLLMProxy(authManagers map[ModelName]*auth.AuthManager, apiKeyManager *APIKeyManager) *LLMProxy {
	return &LLMProxy{
		authManagers:  authManagers,
		apiKeyManager: apiKeyManager,
	}
}

func (l *LLMProxy) ServeRequest(r *http.Request) (*LLMProxyResponse, error) {
	ctx := r.Context()
	req := &LLMProxyRequestBody{}
	if err := render.Bind(r, req); err != nil {
		return nil, errors.Wrapf(err, "failed to bind request body")
	}

	// NOTE: We wanna prefer doing as much parsing as possible before putting load on our auth state.
	err := req.Sanitize()
	if err != nil {
		return nil, errors.Wrapf(err, "failed to sanitize proxy request")
	}

	intendedModel, err := req.ExtractIntendedModel()
	if err != nil {
		return nil, err
	}
	authManager, ok := l.authManagers[intendedModel]
	if !ok {
		return nil, errors.New("no auth manager for intended model")
	}
	apiKey, err := l.apiKeyManager.GetAPIKeyForModel(ctx, intendedModel)
	if err != nil {
		return nil, err
	}

	destURL, err := url.Parse(req.DestURL)
	if err != nil {
		return nil, err
	}

	isTokenValid, err := authManager.VerifyUnBlindedToken(req.Token, req.SignedToken)
	if err != nil {
		return nil, err
	}
	if !isTokenValid {
		return nil, errors.New("invalid token")
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

	authToken := &models.AuthToken{
		DocID: intendedModel,
	}
	isFirstReq := false
	err = models.Fetch(ctx, authToken)
	if err != nil {
		if status.Code(err) != http.StatusNotFound {
			return nil, err
		}
		isFirstReq = true
		reqHash := md5.Sum(req.Bytes())
		authToken = &models.AuthToken{
			DocID:          intendedModel,
			CreatedAt:      time.Now().UTC(),
			ExpiresAt:      time.Now().UTC().Add(time.Minute * 5),
			RequestHash:    reqHash[:],
			CachedResponse: nil,
		}
	}

	if authToken.ExpiresAt.Before(time.Now().UTC()) {
		return nil, errors.New("token expired")
	}
	if !isFirstReq {
		reqHash := md5.Sum(req.Bytes()) // Avoid recomputing
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
		Method: req.HTTPMethod,
		URL:    destURL,
		Header: req.Headers,
		Body:   io.NopCloser(bytes.NewReader(req.Body)),
	}
	reqFwd = reqFwd.WithContext(ctx)
	proxyResp, err := http.DefaultClient.Do(reqFwd)

	switch intendedModel {
	case ModelGemini25Flash:
		reqFwd.Header.Set("x-goog-api-key", apiKey.UnsafeString())
	}

	if err != nil {
		return nil, err
	}
	defer proxyResp.Body.Close()

	proxyRespBytes, err := io.ReadAll(proxyResp.Body)
	if err != nil {
		return nil, err
	}
	resp := &LLMProxyResponse{
		Metadata:      []byte("lgtm"),
		ProxyResponse: proxyRespBytes,
	}
	authToken.CachedResponse = resp.Bytes()
	err = models.Upsert(ctx, authToken)
	if err != nil {
		return nil, err
	}

	return resp, nil
}
