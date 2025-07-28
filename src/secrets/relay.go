package secrets

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"llmmask/src/common"
)

// For Ephemeral RSA Keys.
type EphemeralRSAKeys struct {
	PrivateKey *rsa.PrivateKey
	PublicKey  *rsa.PublicKey
}

// JUST IN CASE.
func (e EphemeralRSAKeys) ToRedacted() common.Redactable {
	res := EphemeralRSAKeys{
		PublicKey:  e.PublicKey,
		PrivateKey: nil,
	}
	return res
}

var ephemeralKeys EphemeralRSAKeys

func GetEphemeralRSAKeys() EphemeralRSAKeys {
	return ephemeralKeys
}

func Init(ctx context.Context) {
	privateKey := common.Must(rsa.GenerateKey(rand.Reader, 2048)) // 2048-bit key size
	publicKey := &privateKey.PublicKey
	ephemeralKeys = EphemeralRSAKeys{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}
}

func RSAEncrypt(publicKey *rsa.PublicKey, msg []byte) ([]byte, error) {
	return rsa.EncryptOAEP(
		sha256.New(),
		rand.Reader,
		publicKey,
		msg,
		nil,
	)
}

func RSADecrypt(pvtKey *rsa.PrivateKey, msg []byte) ([]byte, error) {
	return rsa.DecryptOAEP(
		sha256.New(),
		rand.Reader,
		pvtKey,
		msg,
		nil,
	)
}
