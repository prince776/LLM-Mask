package models

import (
	"cloud.google.com/go/firestore"
	"context"
)

type Model interface {
	DocRef() *firestore.DocumentRef
}

func Upsert(ctx context.Context, m Model) error {
	_, err := m.DocRef().Set(ctx, m)
	return err
}

func Fetch(ctx context.Context, m Model) error {
	data, err := m.DocRef().Get(ctx)
	if err != nil {
		return err
	}
	return data.DataTo(m)
}
