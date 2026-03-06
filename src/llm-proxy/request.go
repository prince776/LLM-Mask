package llm_proxy

import (
	"encoding/json"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"net/http"
)

type LLMProxyExtraBodyReq struct {
	Token       []byte
	SignedToken []byte
	ModelName   string

	PermanentAbuseToken    []byte
	PermanentAbuseTokenSig []byte
	TransientAbuseToken    []byte
	TransientAbuseTokenSig []byte
}


func (b *LLMProxyExtraBodyReq) Sanitize() error {
	if len(b.Token) == 0 || len(b.SignedToken) == 0 {
		return errors.New("missing LLM token or signature")
	}
	if len(b.PermanentAbuseToken) == 0 || len(b.PermanentAbuseTokenSig) == 0 {
		return errors.New("missing permanent abuse token or signature")
	}
	if len(b.TransientAbuseToken) == 0 || len(b.TransientAbuseTokenSig) == 0 {
		return errors.New("missing transient abuse token or signature")
	}
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
