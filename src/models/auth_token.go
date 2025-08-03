package models

import (
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"llmmask/src/db"
	"time"
)

const (
	AuthTokenContainer = "tokens"
)

type AuthToken struct {
	DocID          string `json:"id"` // Same as token.
	CreatedAt      time.Time
	ExpiresAt      time.Time // TODO: Have a job that clears RequestHash and CachedResponse for already expired tokens. Maybe even move them to separate collection.
	RequestHash    []byte
	CachedResponse []byte // To not screw over customers over flaky network.
}

func (u *AuthToken) Container() *azcosmos.ContainerClient {
	return db.ContainerRef(AuthTokenContainer)
}

func (u *AuthToken) ItemID() string {
	return u.DocID
}

func (u *AuthToken) PartitionKey() string {
	// TODO: partition key might be useful here.
	return "primary"
}
