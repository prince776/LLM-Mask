package db

import (
	"context"
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"llmmask/src/common"
	"os"
)

var client *azcosmos.Client
var databaseName string

func databaseID() string {
	if common.IsProd() {
		return "llmmask"
	} else {
		return "llmmaskdev"
	}
}

func Init(ctx context.Context) {
	endpoint := os.Getenv("AZURE_COSMOS_ENDPOINT")
	key := os.Getenv("AZURE_COSMOS_KEY")
	var err error
	client, err = azcosmos.NewClientWithKey(endpoint, key, nil)
	common.Assert(err == nil, "Failed to init Cosmos DB client: %v", err)
	databaseName = databaseID()
}

func Client() *azcosmos.Client {
	return client
}

func ContainerRef(container string) *azcosmos.ContainerClient {
	containerClient, err := Client().NewContainer(databaseName, container)
	common.Assert(err == nil, "Failed to get container client: %v", err)
	return containerClient
}
