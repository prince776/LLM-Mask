package llm_proxy

import (
	"encoding/json"
	"llmmask/src/common"
	"llmmask/src/confs"
	"log"
	"net/http"
)

type LLMProxyExtraBodyReq struct {
	Token       []byte
	SignedToken []byte
	ModelName   string
}

func DestURLForModel(modelName confs.ModelName) string {
	switch modelName {
	case confs.ModelGemini25Flash:
		return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
	default:
		log.Panicf("unknown model name: %s", modelName)
		panic("unreachable")
	}
}

func (b *LLMProxyExtraBodyReq) Sanitize() error {
	// TODO: Sanitize Errors, Content Moderation if legally required.
	return nil
}

func (b *LLMProxyExtraBodyReq) Bytes() []byte {
	if b == nil {
		return []byte{}
	}
	res, err := json.Marshal(b)
	common.Assert(err == nil, "failed to marshal request body")
	return res
}

func (b *LLMProxyExtraBodyReq) Bind(r *http.Request) error {
	return nil
}
