package models

import (
	"context"
	"encoding/json"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore"
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"net/http"
)

type DBHandler struct {
	client       *azcosmos.Client
	databaseName string
}

var defaultDBHandler *DBHandler

func NewDBHandler(cosmosCreds *common.CosmosDBCredsConfig) (*DBHandler, error) {
	connString := cosmosCreds.ConnectionString
	client := common.Must(azcosmos.NewClientFromConnectionString(connString, nil))
	databaseName := cosmosCreds.DatabaseName
	return &DBHandler{client: client, databaseName: databaseName}, nil
}

func Init(ctx context.Context) {
	cosmosCreds := common.PlatformCredsConfig().Cosmos
	defaultDBHandler = common.Must(NewDBHandler(cosmosCreds))
}

func DefaultDBHandler() *DBHandler {
	return defaultDBHandler
}

func Deserialize(data []byte, m Model) error {
	return json.Unmarshal(data, m)
}

func (d *DBHandler) Upsert(ctx context.Context, m Model) error {
	m.GetPartitionKey() // Fill it
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	_, err = d.ContainerRef(m).UpsertItem(
		ctx,
		azcosmos.NewPartitionKeyString(m.GetPartitionKey()),
		data,
		nil,
	)
	return errors.Wrapf(err, "failed to upsert")
}

func (d *DBHandler) Delete(ctx context.Context, m Model) error {
	m.GetPartitionKey() // Fill it
	_, err := d.ContainerRef(m).DeleteItem(
		ctx,
		azcosmos.NewPartitionKeyString(m.GetPartitionKey()),
		m.ItemID(),
		nil,
	)
	return errors.Wrapf(err, "failed to delete")
}

func (d *DBHandler) Fetch(ctx context.Context, m Model) error {
	resp, err := d.ContainerRef(m).ReadItem(
		ctx,
		azcosmos.NewPartitionKeyString(m.GetPartitionKey()),
		m.ItemID(),
		nil,
	)
	if err != nil {
		return errors.Wrapf(err, "failed to fetch")
	}
	if resp.RawResponse.StatusCode != 200 {
		return errors.Newf("unexpected resp: %v, %v", resp.RawResponse.Status, resp.RawResponse.Status)
	}
	return Deserialize(resp.Value, m)
}

func (d *DBHandler) ContainerRef(m Model) *azcosmos.ContainerClient {
	containerClient, err := d.client.NewContainer(d.databaseName, m.Container())
	common.Assert(err == nil, "Failed to get container defaultClient: %v", err)
	return containerClient
}

func IsNotFoundErr(err error) bool {
	var responseErr *azcore.ResponseError
	if errors.As(err, &responseErr) {
		return responseErr.StatusCode == http.StatusNotFound
	}
	return false
}
