package models

type Model interface {
	Container() string
	GetPartitionKey() string
	ItemID() string
}
