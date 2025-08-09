package models

const (
	RSAKeyContainer = "rsa_keys"
)

// RSAKeys - The Public/Private key pair used for blind signing.
// Store the RSA key in DB, because can't call KMS all the time
type RSAKeys struct {
	DocID              string `json:"id"` // Same as model name for ease
	PartitionKey       string `json:"PartitionKey"`
	ModelName          string
	PublicKeyPlaintext []byte
	PrivateKeyWrapped  []byte
	DEKWrapped         []byte // Wraps PrivateKey
	KMSKeyID           string // Wraps DEK
}

func (u *RSAKeys) Container() string {
	return RSAKeyContainer
}

func (u *RSAKeys) ItemID() string {
	return u.DocID
}

func (u *RSAKeys) GetPartitionKey() string {
	u.PartitionKey = DefaultPartitionKey
	return u.PartitionKey
}
