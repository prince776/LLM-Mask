package secrets

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"llmmask/src/common"
)

type RSAKeys struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

// ToRedacted returns a version of the RSAKeys struct with the private key
// redacted. This is a good practice to prevent accidental logging or exposure.
func (e RSAKeys) ToRedacted() common.Redactable {
	res := RSAKeys{
		PublicKey:  e.PublicKey,
		PrivateKey: nil,
	}
	return res
}

var gemini2FlashRSAKeys RSAKeys

func GetGemini2FlashRSAKeys() RSAKeys {
	return gemini2FlashRSAKeys
}

func Init(ctx context.Context) {
	// Generate random keys for testing. In a real application, you would
	// load keys from a secure location, not generate them on startup.
	privateKey := common.Must(rsa.GenerateKey(rand.Reader, 2048)) // 2048-bit key size
	publicKey := &privateKey.PublicKey
	gemini2FlashRSAKeys = RSAKeys{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}
}

// RSAEncrypt encrypts a message using RSA-OAEP.
// OAEP is a recommended padding for encryption.
func RSAEncrypt(publicKey *rsa.PublicKey, msg []byte) ([]byte, error) {
	return rsa.EncryptOAEP(
		sha256.New(),
		rand.Reader,
		publicKey,
		msg,
		nil, // label
	)
}

// RSADecrypt decrypts a message using RSA-OAEP.
func RSADecrypt(pvtKey *rsa.PrivateKey, msg []byte) ([]byte, error) {
	return rsa.DecryptOAEP(
		sha256.New(),
		rand.Reader,
		pvtKey,
		msg,
		nil, // label
	)
}

// RSASign signs a message using the PSS padding scheme.
// The message is first hashed, and the hash is then signed with the private key.
func RSASign(privateKey *rsa.PrivateKey, msg []byte) ([]byte, error) {
	// Hash the message first.
	hashedMsg := sha256.Sum256(msg)

	// Sign the hash.
	signature, err := rsa.SignPSS(
		rand.Reader,
		privateKey,
		crypto.SHA256,
		hashedMsg[:],
		nil,
	)
	if err != nil {
		return nil, err
	}

	return signature, nil
}

// RSAVerify verifies a signature using the PSS padding scheme.
// It re-hashes the original message and then verifies that the signature
// matches the hash with the public key.
func RSAVerify(publicKey *rsa.PublicKey, msg, signature []byte) error {
	// Hash the message first, using the same hash function as signing.
	hashedMsg := sha256.Sum256(msg)

	// Verify the signature against the hash.
	err := rsa.VerifyPSS(
		publicKey,
		crypto.SHA256,
		hashedMsg[:],
		signature,
		nil,
	)

	return err
}
