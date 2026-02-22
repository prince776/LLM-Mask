package confs

import "time"

const (
	AbuseKeyPermanent  = "abuse-permanent" // RSA key doc ID
	AbuseKeyTransient  = "abuse-transient" // RSA key doc ID
	PermanentTokenSize = 48                // bytes
	TransientTokenSize = 48                // bytes (44 random + 4 epoch)
)

// CurrentEpoch returns year*12 + month (1-indexed), used as expiry epoch for transient tokens.
func CurrentEpoch() uint32 {
	now := time.Now().UTC()
	return uint32(now.Year()*12 + int(now.Month()))
}
