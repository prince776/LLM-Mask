package models

const (
	DEKContainer = "deks"
)

type DEK struct {
	DocID        string `json:"id"`
	PartitionKey string `json:"PartitionKey"`
	DEKWrapped   []byte
	KMSKeyID     string // Wraps DEK
}

func (u *DEK) Container() string {
	return DEKContainer
}

func (u *DEK) ItemID() string {
	return u.DocID
}

func (u *DEK) GetPartitionKey() string {
	u.PartitionKey = DefaultPartitionKey
	return u.PartitionKey
}
