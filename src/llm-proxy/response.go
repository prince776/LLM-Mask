package llm_proxy

import (
	"encoding/json"
	"llmmask/src/common"
)

type LLMProxyResponse struct {
	IsBlocked         bool   `json:"is_blocked"`
	BlockedReason     string `json:"blocked_reason"`
	SizeLimitExceeded bool   `json:"size_limit_exceeded"`
	SizeLimitReason   string `json:"size_limit_reason"`
	Metadata          []byte `json:"metadata"`
	ProxyResponse     []byte `json:"proxy_response"`

	AbuseTokenInvalid     bool `json:"abuse_token_invalid,omitempty"`
	AbuseTokenExpired     bool `json:"abuse_token_expired,omitempty"`
	AbuseTokenBlacklisted bool `json:"abuse_token_blacklisted,omitempty"`
}

func (b *LLMProxyResponse) Bytes() []byte {
	if b == nil {
		return []byte{}
	}
	res, err := json.Marshal(b)
	common.Assert(err == nil, "failed to marshal response body")
	return res
}
