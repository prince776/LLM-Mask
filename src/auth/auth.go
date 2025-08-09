package auth

import (
	"bytes"
	"llmmask/src/secrets"
)

type AuthManager struct {
	rsaKeys *secrets.RSAKeys
}

func NewAuthManager(rsaKeys *secrets.RSAKeys) *AuthManager {
	return &AuthManager{
		rsaKeys: rsaKeys,
	}
}

func (a *AuthManager) SignBlindedToken(blindedToken []byte) ([]byte, error) {
	signedBlindedToken, err := secrets.RSASign(a.rsaKeys.PrivateKey, blindedToken)
	if err != nil {
		return nil, err
	}

	return signedBlindedToken, nil
}

func (a *AuthManager) VerifyUnBlindedToken(unblindedToken, signedUnblindedToken []byte) (bool, error) {
	expectedSignedUnblindedToken, err := secrets.RSASign(a.rsaKeys.PrivateKey, unblindedToken)
	if err != nil {
		return false, err
	}

	if !bytes.Equal(expectedSignedUnblindedToken, signedUnblindedToken) {
		return false, nil
	}
	return true, nil
}
