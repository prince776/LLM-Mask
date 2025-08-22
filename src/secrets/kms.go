package secrets

import (
	context "context"
	"encoding/base64"
	"github.com/Azure/azure-sdk-for-go/sdk/azcore/to"
	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"strings"
)

type AzureKMS struct {
	client *azkeys.Client
	key    string
}

var defaultKMS *AzureKMS

func DefaultKMS() *AzureKMS {
	return defaultKMS
}

func Init(ctx context.Context) {
	defaultKMS = common.Must(NewKMS(common.PlatformCredsConfig().KeyVaultCreds))
	InitRSA(ctx)
	InitPlatformDEKs(ctx)
}

func NewKMS(kmsCreds *common.KeyVaultCredsConfig) (*AzureKMS, error) {
	cred, err := azidentity.NewClientSecretCredential(kmsCreds.TenantID, kmsCreds.ClientID, kmsCreds.ClientSecret, nil)
	if err != nil {
		return nil, err
	}
	client, err := azkeys.NewClient(kmsCreds.URL, cred, nil)
	if err != nil {
		return nil, err
	}
	return &AzureKMS{
		client: client,
		key:    kmsCreds.PlatformKey,
	}, nil
}

func (k *AzureKMS) Encrypt(ctx context.Context, plaintext []byte) (string, string, error) {
	params := azkeys.KeyOperationsParameters{
		Algorithm: to.Ptr(azkeys.JSONWebKeyEncryptionAlgorithmRSAOAEP),
		Value:     plaintext,
	}
	resp, err := k.client.Encrypt(ctx, k.key, "", params, nil)
	if err != nil {
		return "", "", errors.Wrapf(err, "failed to encrypt")
	}
	ct := base64.StdEncoding.EncodeToString(resp.Result)
	keyID := *resp.KID
	return ct, string(keyID), nil
}

func (k *AzureKMS) Decrypt(ctx context.Context, ciphertextB64 string, keyID string) ([]byte, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		return nil, err
	}
	params := azkeys.KeyOperationsParameters{
		Algorithm: to.Ptr(azkeys.JSONWebKeyEncryptionAlgorithmRSAOAEP),
		Value:     ciphertext,
	}
	keyName := keyNameFromKeyID(keyID)
	keyVersion := keyVersionFromKeyID(keyID)
	resp, err := k.client.Decrypt(ctx, keyName, keyVersion, params, nil)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to decrypt")
	}
	return resp.Result, nil
}

func keyVersionFromKeyID(kid string) string {
	tokens := strings.Split(kid, "/")
	return tokens[len(tokens)-1]
}

func keyNameFromKeyID(kid string) string {
	tokens := strings.Split(kid, "/")
	return tokens[len(tokens)-2]
}
