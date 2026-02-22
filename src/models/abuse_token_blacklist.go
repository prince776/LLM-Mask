package models

import (
	"crypto/sha256"
	"encoding/base64"
	"time"
)

const AbuseTokenBlacklistContainer = "abuse_token_blacklist"

type AbuseTokenBlacklist struct {
	DocID         string    `json:"id"`
	PartitionKey  string    `json:"PartitionKey"`
	TokenType     string    // "permanent" | "transient"
	BlacklistedAt time.Time
}

func (a *AbuseTokenBlacklist) Container() string {
	return AbuseTokenBlacklistContainer
}

func (a *AbuseTokenBlacklist) ItemID() string {
	return a.DocID
}

func (a *AbuseTokenBlacklist) GetPartitionKey() string {
	a.PartitionKey = DefaultPartitionKey
	return a.PartitionKey
}

// DocIDForAbuseToken returns base64(sha256(token)), same pattern as AuthToken.
func DocIDForAbuseToken(token []byte) string {
	hash := sha256.Sum256(token)
	return base64.StdEncoding.EncodeToString(hash[:])
}
