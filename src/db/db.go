package db

import (
	"context"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"net/http"
)

var client *azcosmos.Client
var databaseName string

func Init(ctx context.Context) {
	credsConf := common.PlatformCredsConfig()
	connString := credsConf.Cosmos.ConnectionString
	client = common.Must(azcosmos.NewClientFromConnectionString(connString, nil))
	databaseName = credsConf.Cosmos.DatabaseName
}

func Client() *azcosmos.Client {
	return client
}

func ContainerRef(container string) *azcosmos.ContainerClient {
	containerClient, err := Client().NewContainer(databaseName, container)
	common.Assert(err == nil, "Failed to get container client: %v", err)
	return containerClient
}

func IsNotFoundErr(err error) bool {
	var responseErr *azcore.ResponseError
	if errors.As(err, &responseErr) {
		return responseErr.StatusCode == http.StatusNotFound
	}
	return false
}
