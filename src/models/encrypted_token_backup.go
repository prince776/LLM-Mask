package models

import "time"

const EncryptedTokenBackupContainer = "encrypted_token_backups"

type EncryptedTokenBackup struct {
	DocID         string    `json:"id"` // User ID (Google ID / user DocID)
	PartitionKey  string    `json:"PartitionKey"`
	EncryptedBlob string    // Base64-encoded AES-GCM ciphertext (client-side encryption)
	UpdatedAt     time.Time
}

func (e *EncryptedTokenBackup) Container() string {
	return EncryptedTokenBackupContainer
}

func (e *EncryptedTokenBackup) ItemID() string {
	return e.DocID
}

func (e *EncryptedTokenBackup) GetPartitionKey() string {
	e.PartitionKey = DefaultPartitionKey
	return e.PartitionKey
}
