package models

import (
	"cloud.google.com/go/firestore"
	"llmmask/src/db"
	"time"
)

const (
	AuthTokenCollection = "tokens"
)

type AuthToken struct {
	DocID          string // Same as token.
	CreatedAt      time.Time
	ExpiresAt      time.Time // TODO: Have a job that clears RequestHash and CachedResponse for already expired tokens. Maybe even move them to separate collection.
	RequestHash    []byte
	CachedResponse []byte // To not screw over customers over flaky network.
}

func (u *AuthToken) DocRef() *firestore.DocumentRef {
	return AuthTokenCollRef().Doc(u.DocID)
}

func AuthTokenCollRef() *firestore.CollectionRef {
	return db.CollectionRef(AuthTokenCollection)
}
