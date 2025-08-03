package models

import (
	"context"
	"fmt"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/runtime"
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"llmmask/src/db"
)

const (
	UserSessionContainer    = "user_sessions"
	UserSessionPartitionKey = "primary"
)

type UserSession struct {
	// Public Fields.
	DocID     string `json:"id"`
	UserDocID string
	Expired   bool
}

func (u *UserSession) Container() *azcosmos.ContainerClient {
	return db.ContainerRef(UserSessionContainer)
}

func (u *UserSession) ItemID() string {
	return u.DocID
}

func (u *UserSession) PartitionKey() string {
	return UserSessionPartitionKey
}

func ListUserSessions(ctx context.Context, userDocID string) *runtime.Pager[azcosmos.QueryItemsResponse] {
	dummySess := UserSession{}
	partitionKey := azcosmos.NewPartitionKeyString(dummySess.PartitionKey())
	query := fmt.Sprintf("SELECT * FROM %s t WHERE t.id = @userID", UserSessionContainer)
	queryOptions := azcosmos.QueryOptions{
		QueryParameters: []azcosmos.QueryParameter{
			{Name: "@userID", Value: userDocID},
		},
	}

	return dummySess.Container().NewQueryItemsPager(query, partitionKey, &queryOptions)
}
