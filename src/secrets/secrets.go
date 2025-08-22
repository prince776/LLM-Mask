package secrets

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"llmmask/src/common"
	"llmmask/src/models"
)

const (
	userCredsDEKID = "user-creds-dek"
)

// TODO: Get From KMS.
var userCredsDEKStr string

func InitPlatformDEKs(ctx context.Context) {
	dbHandler := models.DefaultDBHandler()
	kms := DefaultKMS()

	userCredsDEK := &models.DEK{
		DocID: userCredsDEKID,
	}
	common.Must2(dbHandler.Fetch(ctx, userCredsDEK))

	unwrappedDEKValue := common.Must(kms.Decrypt(ctx, string(userCredsDEK.DEKWrapped), userCredsDEK.KMSKeyID))
	userCredsDEKStr = string(unwrappedDEKValue)
}

func NewRandomAESKey() ([]byte, error) {
	res := make([]byte, 32)
	n, err := rand.Read(res)
	if err != nil {
		return nil, err
	}
	if n != 32 {
		return nil, errors.New("failed to generate random AES key")
	}
	return res, nil
}

func EncryptUserCreds(userData string) (string, error) {
	return EncryptAES(userData, userCredsDEKStr)
}

func DecryptUserData(userDataEncrypted string) (string, error) {
	return DecryptAES(userDataEncrypted, userCredsDEKStr)
}

// EncryptAES encrypts plain text using a key and returns the base64 encoded cipher text.
func EncryptAES(plainText, key string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherText := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.URLEncoding.EncodeToString(cipherText), nil
}

// DecryptAES decrypts base64 encoded cipher text using the provided key and returns the original plain text.
func DecryptAES(cipherText, key string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	cipherData, err := base64.URLEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(cipherData) < nonceSize {
		return "", errors.New("ciphertext too short")
	}

	nonce, cipherData := cipherData[:nonceSize], cipherData[nonceSize:]
	plainText, err := gcm.Open(nil, nonce, cipherData, nil)
	if err != nil {
		return "", err
	}

	return string(plainText), nil
}
