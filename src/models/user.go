package models

import (
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"llmmask/src/common"
	"llmmask/src/db"
)

const (
	UserContainer = "users"
)

type User struct {
	// Public Fields.
	DocID    string `json:"id"`
	GoogleID string
	Email    string
	Name     string

	TokenSerialized string

	SubscriptionInfo SubscriptionInfo
}

func (u *User) Container() *azcosmos.ContainerClient {
	return db.ContainerRef(UserContainer)
}

func (u *User) ItemID() string {
	return u.DocID
}

func (u *User) PartitionKey() string {
	return "primary"
}

func (u *User) ToRedacted() common.Redactable {
	res := common.DeepCopyJSONMust(u)
	res.TokenSerialized = "<REDACTED>"
	return res
}

type SubscriptionInfo struct {
	ActiveAuthTokens AuthTokenInfo
	UsedAuthTokens   AuthTokenInfo
	// Payment log for sake of recalculation in case some screw up happens.
	PaymentLogs []PaymentLog
}

type AuthTokenInfo = map[string]int

type PaymentLog struct {
	PaymentID     string
	TokensGranted AuthTokenInfo
}
