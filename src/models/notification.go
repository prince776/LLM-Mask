package models

import "time"

const NotificationContainer = "notifications"

type Notification struct {
	DocID        string    `json:"id"`
	PartitionKey string    `json:"PartitionKey"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"createdAt"`
}

func (n *Notification) Container() string {
	return NotificationContainer
}

func (n *Notification) ItemID() string {
	return n.DocID
}

func (n *Notification) GetPartitionKey() string {
	n.PartitionKey = DefaultPartitionKey
	return n.PartitionKey
}
