package secrets

import (
	"context"
	"github.com/stretchr/testify/assert"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/log"
	"llmmask/src/models"
	"testing"
)

func TestBulkEncryptAndSaveKeys(t *testing.T) {
	log.Init()
	modelsToProvision := []string{
		confs.ModelChatGPT5Mini, confs.ModelChatGPT53,
	}
	ctx := context.Background()

	// Initialize your handlers once
	kms, err := NewKMS(&common.KeyVaultCredsConfig{})
	assert.Nil(t, err)
	dbHandler, err := models.NewDBHandler(&common.CosmosDBCredsConfig{})
	assert.Nil(t, err)

	for _, modelName := range modelsToProvision {
		rsaKey := &models.RSAKeys{
			DocID: modelName,
		}
		err := dbHandler.Fetch(ctx, rsaKey)
		if err != nil && !models.IsNotFoundErr(err) {
			assert.FailNow(t, err.Error())
		}
		if err == nil {
			log.Infof(ctx, "RSA Key already exists skipping: %s", modelName)
			continue
		}

		log.Infof(ctx, "Generating RSA Key for: %s", modelName)
		// Step 1: Generate keys automatically
		pubStr, privStr, err := GenerateRSAKeyPair()
		assert.Nil(t, err)

		log.Infof(ctx, "PubKey for %s: %s", modelName, pubStr)

		// Step 2: Generate local DEK
		dek, err := NewRandomAESKey()
		assert.Nil(t, err)

		// Step 3: Wrap Private Key with DEK
		privateKeyWrapped, err := EncryptAES(privStr, string(dek))
		assert.Nil(t, err)

		// Step 4: Wrap DEK with KMS
		dekWrapped, keyID, err := kms.Encrypt(ctx, dek)
		assert.Nil(t, err)

		// Step 5: Save to DB
		rsaKey = &models.RSAKeys{
			DocID:              modelName,
			ModelName:          modelName,
			PublicKeyPlaintext: []byte(pubStr),
			PrivateKeyWrapped:  []byte(privateKeyWrapped),
			DEKWrapped:         []byte(dekWrapped),
			KMSKeyID:           keyID,
		}

		err = dbHandler.Upsert(ctx, rsaKey)
		assert.Nil(t, err, "Failed to upsert key for %s", modelName)
		log.Infof(ctx, "Generated RSA Key for: %s", modelName)
	}
}

// Sample Test to save a rsa key to db. Fill the creds.
func TestEncryptAndSaveKey(t *testing.T) {
	publicKeyStr := `-----BEGIN PUBLIC KEY-----
-----END PUBLIC KEY-----`
	privateKeyStr := `-----BEGIN PRIVATE KEY-----
-----END PRIVATE KEY-----`

	ctx := context.Background()
	kms, err := NewKMS(&common.KeyVaultCredsConfig{
		// ADD.
	})
	assert.Nil(t, err)

	dek, err := NewRandomAESKey()
	assert.Nil(t, err)

	privateKeyWrapped, err := EncryptAES(privateKeyStr, string(dek))
	assert.Nil(t, err)

	dekWrapped, keyID, err := kms.Encrypt(ctx, dek)
	assert.Nil(t, err, "got err %+v", err)

	rsaKey := &models.RSAKeys{
		//DocID:              confs.ModelGemini25Pro,
		//ModelName:          confs.ModelGemini25Pro,
		PublicKeyPlaintext: []byte(publicKeyStr),
		PrivateKeyWrapped:  []byte(privateKeyWrapped),
		DEKWrapped:         []byte(dekWrapped),
		KMSKeyID:           keyID,
	}

	dbHandler, err := models.NewDBHandler(&common.CosmosDBCredsConfig{
		DatabaseName:     "llmtordb",
		ConnectionString: "", // ADD
	})
	assert.Nil(t, err)
	err = dbHandler.Upsert(ctx, rsaKey)
	assert.Nil(t, err)
}

// Sample Test to save user-creds-dek.
func TestAddUserCredsDEK(t *testing.T) {
	ctx := context.Background()
	kms, err := NewKMS(&common.KeyVaultCredsConfig{
		// ADD.
	})
	assert.Nil(t, err)

	userCredsDEKPT, err := NewRandomAESKey()
	assert.Nil(t, err)

	dekWrapped, keyID, err := kms.Encrypt(ctx, userCredsDEKPT)
	assert.Nil(t, err, "got err %+v", err)

	rsaKey := &models.DEK{
		DocID:      userCredsDEKID,
		DEKWrapped: []byte(dekWrapped),
		KMSKeyID:   keyID,
	}

	dbHandler, err := models.NewDBHandler(&common.CosmosDBCredsConfig{
		DatabaseName:     "llmtordb",
		ConnectionString: "", // ADD
	})
	assert.Nil(t, err)
	err = dbHandler.Upsert(ctx, rsaKey)
	assert.Nil(t, err)
}
