package llm_proxy

import (
	"encoding/json"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"llmmask/src/confs"
	"net/http"
	"strings"
)

type LLMProxyRequestBody struct {
	Token       []byte              `json:"token"`
	SignedToken []byte              `json:"signed_token"`
	Headers     map[string][]string `json:"headers"`
	DestURL     string              `json:"dest_url"`
	HTTPMethod  string              `json:"http_method"`
	Body        []byte              `json:"body"`
}

func (b *LLMProxyRequestBody) ExtractIntendedModel() (confs.ModelName, error) {
	if strings.HasPrefix(b.DestURL, "https://generativelanguage.googleapis.com") {
		tokens := strings.Split(b.DestURL, "/")
		modelName := tokens[len(tokens)-1]
		modelName = strings.TrimSuffix(modelName, ":generateContent")
		return modelName, nil
	}
	return "", errors.New("unrecognized/unsupported model being requested.")
}

func (b *LLMProxyRequestBody) Sanitize() error {
	// TODO: Sanitize Errors, Content Moderation if legally required.
	return nil
}

func (b *LLMProxyRequestBody) Bytes() []byte {
	if b == nil {
		return []byte{}
	}
	res, err := json.Marshal(b)
	common.Assert(err == nil, "failed to marshal request body")
	return res
}

func (b *LLMProxyRequestBody) Bind(r *http.Request) error {
	return nil
}
