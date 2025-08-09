package models

import (
	"time"
)

const DefaultPartitionKey = "primary"

const (
	AuthTokenContainer = "auth_tokens"
)

type AuthToken struct {
	DocID          string `json:"id"` // Same as token.
	PartitionKey   string `json:"PartitionKey"`
	CreatedAt      time.Time
	ExpiresAt      time.Time // TODO: Have a job that clears RequestHash and CachedResponse for already expired tokens. Maybe even move them to separate collection.
	RequestHash    []byte
	CachedResponse []byte // To not screw over customers over flaky network.
}

func (u *AuthToken) Container() string {
	return AuthTokenContainer
}

func (u *AuthToken) ItemID() string {
	return u.DocID
}

func (u *AuthToken) GetPartitionKey() string {
	// TODO: partition key might be useful here.
	u.PartitionKey = DefaultPartitionKey
	return u.PartitionKey
}
