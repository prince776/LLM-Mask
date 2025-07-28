package models

import (
	"context"
	"llmmask/src/db"

	"cloud.google.com/go/firestore"
)

const (
	UserSessionCollection = "user_sessions"
)

type UserSession struct {
	// Public Fields.
	DocID     string
	UserDocID string
	Expired   bool
}

func (u *UserSession) DocRef() *firestore.DocumentRef {
	return UserCollRef().Doc(u.DocID)
}

func UserSessionCollRef() *firestore.CollectionRef {
	return db.CollectionRef(UserSessionCollection)
}

func ListUserSessions(ctx context.Context, userDocID string) *firestore.DocumentIterator {
	return UserSessionCollRef().Where("UserDocID", "==", userDocID).Documents(ctx)
}
