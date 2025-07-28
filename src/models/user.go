package models

import (
	"cloud.google.com/go/firestore"
	"llmmask/src/common"
	"llmmask/src/db"
)

const (
	UserCollection = "users"
)

type User struct {
	// Public Fields.
	DocID    string
	GoogleID string
	Email    string
	Name     string

	TokenSerialized string
}

func (u *User) DocRef() *firestore.DocumentRef {
	return UserCollRef().Doc(u.DocID)
}

func UserCollRef() *firestore.CollectionRef {
	return db.CollectionRef(UserCollection)
}

func (u *User) ToRedacted() common.Redactable {
	res := common.DeepCopyJSONMust(u)
	res.TokenSerialized = "<REDACTED>"
	return res
}
