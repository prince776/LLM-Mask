package auth

import (
	"encoding/binary"
	"github.com/cockroachdb/errors"
	"llmmask/src/confs"
	"llmmask/src/secrets"
)

// ErrAbuseTokenExpired is returned when a transient abuse token's epoch does not match the current epoch.
var ErrAbuseTokenExpired = errors.New("transient abuse token expired")

type AuthManager struct {
	rsaKeys *secrets.RSAKeys
}

func NewAuthManager(rsaKeys *secrets.RSAKeys) *AuthManager {
	return &AuthManager{
		rsaKeys: rsaKeys,
	}
}

func (a *AuthManager) SignBlindedToken(blindedToken []byte) ([]byte, error) {
	signedBlindedToken, err := secrets.RSASignBlinded(a.rsaKeys.PrivateKey, blindedToken)
	if err != nil {
		return nil, err
	}

	return signedBlindedToken, nil
}

func (a *AuthManager) VerifyUnBlindedToken(unblindedToken, signedUnblindedToken []byte) (bool, error) {
	err := secrets.RSABlindVerify(a.rsaKeys.PublicKey, unblindedToken, signedUnblindedToken)
	if err != nil {
		return false, err
	}
	return true, nil
}

// AbuseAuthManager handles blind signing and verification for the permanent and transient abuse tokens.
type AbuseAuthManager struct {
	permanentKeys *secrets.RSAKeys
	transientKeys *secrets.RSAKeys
}

func NewAbuseAuthManager(permanentKeys, transientKeys *secrets.RSAKeys) *AbuseAuthManager {
	return &AbuseAuthManager{
		permanentKeys: permanentKeys,
		transientKeys: transientKeys,
	}
}

func (a *AbuseAuthManager) SignPermanentBlindedToken(blinded []byte) ([]byte, error) {
	return secrets.RSASignBlinded(a.permanentKeys.PrivateKey, blinded)
}

func (a *AbuseAuthManager) SignTransientBlindedToken(blinded []byte) ([]byte, error) {
	return secrets.RSASignBlinded(a.transientKeys.PrivateKey, blinded)
}

// VerifyPermanentToken verifies the RSA blind signature on a permanent abuse token.
func (a *AbuseAuthManager) VerifyPermanentToken(token, sig []byte) error {
	return secrets.RSABlindVerify(a.permanentKeys.PublicKey, token, sig)
}

// VerifyTransientToken verifies the RSA blind signature on a transient abuse token.
// The token must be exactly TransientTokenSize bytes; the last 4 bytes encode the epoch (big-endian uint32).
// Returns ErrAbuseTokenExpired if the embedded epoch != CurrentEpoch().
func (a *AbuseAuthManager) VerifyTransientToken(token, sig []byte) error {
	if err := secrets.RSABlindVerify(a.transientKeys.PublicKey, token, sig); err != nil {
		return err
	}
	if len(token) < 4 {
		return errors.New("transient abuse token too short")
	}
	epoch := binary.BigEndian.Uint32(token[len(token)-4:])
	if epoch != confs.CurrentEpoch() {
		return ErrAbuseTokenExpired
	}
	return nil
}
