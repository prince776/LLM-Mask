package models

import "time"

const FeedbackContainer = "feedback"

// ThreadEntry is a single message in a feedback thread.
type ThreadEntry struct {
	Role      string    `json:"Role"`      // "user" | "admin"
	Content   string    `json:"Content"`
	CreatedAt time.Time `json:"CreatedAt"`
}

// FeedbackThread is a support chat thread between a user and the admin.
// DocID = UserDocID — one thread per user.
type FeedbackThread struct {
	DocID        string        `json:"id"`
	PartitionKey string        `json:"PartitionKey"`
	UserDocID    string        `json:"UserDocID"`
	UserEmail    string        `json:"UserEmail"`
	UserName     string        `json:"UserName"`
	Status       string        `json:"Status"` // "open" | "replied"
	Entries      []ThreadEntry `json:"Entries"`
	CreatedAt    time.Time     `json:"CreatedAt"`
	UpdatedAt    time.Time     `json:"UpdatedAt"`
}

func (f *FeedbackThread) Container() string {
	return FeedbackContainer
}

func (f *FeedbackThread) ItemID() string {
	return f.DocID
}

func (f *FeedbackThread) GetPartitionKey() string {
	f.PartitionKey = DefaultPartitionKey
	return f.PartitionKey
}
