package secrets

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/x509"
	"encoding/pem"
	"github.com/cloudflare/circl/blindsign/blindrsa"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/log"
	"llmmask/src/models"
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

var rsaKeysPerModel map[confs.ModelName]*RSAKeys

func GetRSAKeysForModel(modelName confs.ModelName) *RSAKeys {
	return rsaKeysPerModel[modelName]
}

func InitRSA(ctx context.Context) {
	rsaKeysPerModel = make(map[confs.ModelName]*RSAKeys)
	dbHandler := models.DefaultDBHandler()
	kms := DefaultKMS()
	for _, modelName := range confs.AllModels() {
		log.Infof(ctx, "Loading rsa for model: %s", modelName)
		rsaKey := &models.RSAKeys{
			DocID: modelName,
		}
		common.Must2(dbHandler.Fetch(ctx, rsaKey))

		dek := common.Must(kms.Decrypt(ctx, string(rsaKey.DEKWrapped), rsaKey.KMSKeyID))

		privateKeyPT := common.Must(DecryptAES(string(rsaKey.PrivateKeyWrapped), string(dek)))
		publicKeyPT := string(rsaKey.PublicKeyPlaintext)

		rsaKeysForModel := common.Must(RSALoad(privateKeyPT, publicKeyPT))
		rsaKeysPerModel[modelName] = rsaKeysForModel
		log.Infof(ctx, "Loaded RSA keys for model: %s", modelName)
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
	h := sha512.New384()
	h.Write(msg)
	hashedMsg := h.Sum(nil)

	// Sign the hash.
	signature, err := rsa.SignPSS(
		rand.Reader,
		privateKey,
		crypto.SHA384,
		hashedMsg[:],
		nil,
	)
	if err != nil {
		return nil, err
	}

	return signature, nil
}

// RSASignBlinded receives a blinded token from the client, signs it, and returns the signed blinded token.
func RSASignBlinded(privateKey *rsa.PrivateKey, msg []byte) ([]byte, error) {
	signer := blindrsa.NewSigner(privateKey)
	signedBlindedToken, err := signer.BlindSign(msg)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to sign blinded token")
	}

	return signedBlindedToken, nil
}

// RSABlindVerify receives a signed unblinded token from the client, and verifies it.
func RSABlindVerify(publicKey *rsa.PublicKey, msg, signedMsg []byte) error {
	verifier, err := blindrsa.NewVerifier(blindrsa.SHA384PSSRandomized, publicKey)
	if err != nil {
		return err
	}
	return verifier.Verify(msg, signedMsg)
}

// RSAVerify verifies a signature using the PSS padding scheme.
// It re-hashes the original message and then verifies that the signature
// matches the hash with the public key.
func RSAVerify(publicKey *rsa.PublicKey, msg, signature []byte) error {
	// Hash the message first, using the same hash function as signing.
	h := sha512.New384()
	h.Write(msg)
	hashedMsg := h.Sum(nil)

	// Verify the signature against the hash.
	err := rsa.VerifyPSS(
		publicKey,
		crypto.SHA384,
		hashedMsg[:],
		signature,
		nil,
	)

	return err
}

func RSALoad(privateKeyPEM, publicKeyStr string) (*RSAKeys, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil || block.Type != "PRIVATE KEY" {
		return nil, errors.Newf("Failed to decode PEM block containing RSA private key, block %+v", block)
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, errors.Newf("Failed to parse RSA private key: %v", err)
	}
	privateRSAKey, ok := privateKey.(*rsa.PrivateKey)

	block, _ = pem.Decode([]byte(publicKeyStr))
	if block == nil || block.Type != "PUBLIC KEY" {
		return nil, errors.Newf("Failed to decode PEM block containing public key")
	}

	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, errors.Newf("Failed to parse RSA public key: %v", err)
	}
	publicRSAKey, ok := publicKey.(*rsa.PublicKey)
	if !ok {
		return nil, errors.Newf("Failed to parse RSA public key")
	}

	return &RSAKeys{
		PrivateKey: privateRSAKey,
		PublicKey:  publicRSAKey,
	}, nil
}
