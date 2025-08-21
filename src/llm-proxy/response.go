package llm_proxy

import (
	"encoding/json"
	"llmmask/src/common"
)

type LLMProxyResponse struct {
	IsBlocked     bool   `json:"is_blocked"`
	BlockedReason string `json:"blocked_reason"`
	Metadata      []byte `json:"metadata"`
	ProxyResponse []byte `json:"proxy_response"`
}

func (b *LLMProxyResponse) Bytes() []byte {
	if b == nil {
		return []byte{}
	}
	res, err := json.Marshal(b)
	common.Assert(err == nil, "failed to marshal response body")
	return res
}
