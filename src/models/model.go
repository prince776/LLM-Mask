package models

import (
	"context"
	"encoding/json"
	"github.com/Azure/azure-sdk-for-go/sdk/data/azcosmos"
	"github.com/cockroachdb/errors"
)

type Model interface {
	Container() *azcosmos.ContainerClient
	PartitionKey() string
	ItemID() string
}

func Deserialize(data []byte, m Model) error {
	return json.Unmarshal(data, m)
}

func Upsert(ctx context.Context, m Model) error {
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	_, err = m.Container().UpsertItem(
		ctx,
		azcosmos.NewPartitionKeyString(m.PartitionKey()),
		data,
		nil,
	)
	return err
}

func Delete(ctx context.Context, m Model) error {
	_, err := m.Container().DeleteItem(
		ctx,
		azcosmos.NewPartitionKeyString(m.PartitionKey()),
		m.ItemID(),
		nil,
	)
	return err
}

func Fetch(ctx context.Context, m Model) error {
	resp, err := m.Container().ReadItem(
		ctx,
		azcosmos.NewPartitionKeyString(m.PartitionKey()),
		m.ItemID(),
		nil,
	)
	if err != nil {
		return err
	}
	if resp.RawResponse.StatusCode != 200 {
		return errors.Newf("unexpected resp: %v, %v", resp.RawResponse.Status, resp.RawResponse.Status)
	}
	return Deserialize(resp.Value, m)
}
