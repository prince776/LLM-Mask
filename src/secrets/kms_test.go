package secrets

import (
	"context"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/models"
	"testing"
)

// Sample Test to save a rsa key to db. Fill the creds.
func TestEncryptAndSaveKey(t *testing.T) {
	publicKeyStr := `----BEGIN PUBLIC KEY-----
<PUBLIC KEY>
-----END PUBLIC KEY-----
`
	privateKeyStr := `-----BEGIN PRIVATE KEY-----
<PRIVATE KEY>
-----END PRIVATE KEY-----
`

	ctx := context.Background()
	kms, err := NewKMS(&common.KeyVaultCredsConfig{
		// Add Creds.
	})
	assert.Nil(t, err)

	dek, err := NewRandomAESKey()
	assert.Nil(t, err)

	privateKeyWrapped, err := EncryptAES(privateKeyStr, string(dek))
	assert.Nil(t, err)

	dekWrapped, keyID, err := kms.Encrypt(ctx, dek)
	assert.Nil(t, err, "got err %+v", err)

	rsaKey := &models.RSAKeys{
		DocID:              uuid.New().String(),
		ModelName:          confs.ModelGemini25Flash,
		PublicKeyPlaintext: []byte(publicKeyStr),
		PrivateKeyWrapped:  []byte(privateKeyWrapped),
		DEKWrapped:         []byte(dekWrapped),
		KMSKeyID:           keyID,
	}

	dbHandler, err := models.NewDBHandler(&common.CosmosDBCredsConfig{
		// Add Creds
	})
	assert.Nil(t, err)
	err = dbHandler.Upsert(ctx, rsaKey)
	assert.Nil(t, err)
}
