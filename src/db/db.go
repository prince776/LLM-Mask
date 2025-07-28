package db

import (
	"context"
	"llmmask/src/common"

	"cloud.google.com/go/firestore"
)

var client *firestore.Client

func databaseID() string {
	if common.IsProd() {
		return "llmmask"
	} else {
		return "llmmask"
	}
}

func Init(ctx context.Context) {
	var err error
	client, err = firestore.NewClientWithDatabase(ctx, firestore.DetectProjectID, databaseID(), common.PlatformSvcAccCredsOption())
	common.Assert(err == nil, "Failed to init db client: %v", err)
}

func Client() *firestore.Client {
	return client
}

func DocRef(collection string, doc string) *firestore.DocumentRef {
	return client.Collection(collection).Doc(doc)
}

func CollectionRef(collection string) *firestore.CollectionRef {
	return client.Collection(collection)
}
