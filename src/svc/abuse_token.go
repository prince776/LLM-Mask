package svc

import (
	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/models"
	"net/http"
	"time"
)

const (
	// maxBlindedTokenBytes is a liberal upper bound for RSA blinded messages.
	// RSA-2048 produces 256-byte blinded messages; this allows up to RSA-8192.
	maxBlindedTokenBytes = 1024
	// maxBackupBlobBytes is a liberal upper bound for encrypted backup blobs.
	// Legitimate blobs are ~1 KB; 100 KB provides ample headroom.
	maxBackupBlobBytes = 100 * 1024
	// permanentTokenReissuanceWindow is the grace period after initial issuance
	// during which the server will re-sign a new blinded token. This covers the
	// case where the DB write succeeded but the HTTP response never reached the client.
	permanentTokenReissuanceWindow = 10 * time.Minute
	// maxTransientRotationsPerEpoch caps how many times a user can rotate their
	// transient abuse token within a single calendar-month epoch.
	maxTransientRotationsPerEpoch = 30
)

// IssueAbuseTokenReq is the request body for issuing a blind-signed abuse token.
type IssueAbuseTokenReq struct {
	noValidationReq
	BlindedToken []byte
}

// IssueAbuseTokenResp is the response body for issuing a blind-signed abuse token.
type IssueAbuseTokenResp struct {
	SignedBlindedToken []byte
}

// StoreBackupReq is the request body for storing an encrypted token backup.
type StoreBackupReq struct {
	noValidationReq
	EncryptedBlob string
}

// GetBackupResp is the response body for retrieving an encrypted token backup.
type GetBackupResp struct {
	EncryptedBlob string
}

// IssuePermanentAbuseTokenHandler issues a blind-signed permanent abuse token.
// Each user may only obtain one permanent token (enforced by PermanentAbuseTokenIssuedAt).
// If the token was already issued within the last 10 minutes, re-signing is allowed to
// recover from cases where the client never received the original response.
func (s *Service) IssuePermanentAbuseTokenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	req := &IssueAbuseTokenReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}
	if len(req.BlindedToken) > maxBlindedTokenBytes {
		render.Render(w, r, ErrInvalidRequest(errors.Newf("blinded token too large: max %d bytes", maxBlindedTokenBytes)))
		return
	}

	sem := &common.SemaphoreConf{
		Handle:  "issue-permanent-abuse-token-" + user.DocID,
		Request: 1,
		Limit:   1,
	}
	if err := common.AcquireSemaphore(ctx, sem); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}
	defer common.ReleaseSemaphore(sem)

	// Re-fetch inside semaphore to get authoritative state
	if err := s.dbHandler.Fetch(ctx, user); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	if user.PermanentAbuseTokenIssuedAt != nil {
		if time.Since(*user.PermanentAbuseTokenIssuedAt) > permanentTokenReissuanceWindow {
			render.Render(w, r, &ErrResponse{
				HTTPStatusCode: 409,
				StatusText:     "Conflict",
				ErrorText:      "permanent abuse token already issued for this account",
			})
			return
		}
		// Within the reissuance window: re-sign the new blinded token without touching
		// the DB (the original IssuedAt timestamp is preserved to bound the window).
		signed, err := s.abuseAuthManager.SignPermanentBlindedToken(req.BlindedToken)
		if err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}
		render.Render(w, r, Ok200(&IssueAbuseTokenResp{SignedBlindedToken: signed}))
		return
	}

	signed, err := s.abuseAuthManager.SignPermanentBlindedToken(req.BlindedToken)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	now := time.Now().UTC()
	user.PermanentAbuseTokenIssuedAt = &now
	if err := s.dbHandler.Upsert(ctx, user); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(&IssueAbuseTokenResp{SignedBlindedToken: signed}))
}

// IssueTransientAbuseTokenHandler issues a blind-signed transient abuse token for the current epoch.
// If a token was already issued for the current epoch, re-signing is allowed to recover from
// cases where the client never received the original response. A new epoch always produces a
// new token (and records the new epoch on the user doc).
func (s *Service) IssueTransientAbuseTokenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	req := &IssueAbuseTokenReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}
	if len(req.BlindedToken) > maxBlindedTokenBytes {
		render.Render(w, r, ErrInvalidRequest(errors.Newf("blinded token too large: max %d bytes", maxBlindedTokenBytes)))
		return
	}

	sem := &common.SemaphoreConf{
		Handle:  "issue-transient-abuse-token-" + user.DocID,
		Request: 1,
		Limit:   1,
	}
	if err := common.AcquireSemaphore(ctx, sem); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}
	defer common.ReleaseSemaphore(sem)

	// Re-fetch inside semaphore
	if err := s.dbHandler.Fetch(ctx, user); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	currentEpoch := confs.CurrentEpoch()
	if user.TransientAbuseTokenEpoch == currentEpoch {
		// Already issued for this epoch: allow rotation up to the per-epoch cap.
		if user.TransientAbuseTokenRotations >= maxTransientRotationsPerEpoch {
			render.Render(w, r, &ErrResponse{
				HTTPStatusCode: 429,
				StatusText:     "Too Many Requests",
				ErrorText:      "transient abuse token rotation limit reached for this epoch",
			})
			return
		}
		signed, err := s.abuseAuthManager.SignTransientBlindedToken(req.BlindedToken)
		if err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}
		user.TransientAbuseTokenRotations++
		if err := s.dbHandler.Upsert(ctx, user); err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}
		render.Render(w, r, Ok200(&IssueAbuseTokenResp{SignedBlindedToken: signed}))
		return
	}

	// New epoch: sign and reset the rotation counter to 1.
	signed, err := s.abuseAuthManager.SignTransientBlindedToken(req.BlindedToken)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	user.TransientAbuseTokenEpoch = currentEpoch
	user.TransientAbuseTokenRotations = 1
	if err := s.dbHandler.Upsert(ctx, user); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(&IssueAbuseTokenResp{SignedBlindedToken: signed}))
}

// StoreAbuseTokenBackupHandler stores (upserts) an encrypted abuse token backup for the authenticated user.
func (s *Service) StoreAbuseTokenBackupHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	req := &StoreBackupReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}
	if len(req.EncryptedBlob) > maxBackupBlobBytes {
		render.Render(w, r, ErrInvalidRequest(errors.Newf("backup blob too large: max %d bytes", maxBackupBlobBytes)))
		return
	}

	backup := &models.EncryptedTokenBackup{
		DocID:         user.DocID,
		EncryptedBlob: req.EncryptedBlob,
		UpdatedAt:     time.Now().UTC(),
	}
	if err := s.dbHandler.Upsert(ctx, backup); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(nil))
}

// GetAbuseTokenBackupHandler fetches the encrypted abuse token backup for the authenticated user.
func (s *Service) GetAbuseTokenBackupHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	backup := &models.EncryptedTokenBackup{
		DocID: user.DocID,
	}
	if err := s.dbHandler.Fetch(ctx, backup); err != nil {
		if models.IsNotFoundErr(err) {
			render.Render(w, r, ErrNotFound())
			return
		}
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(&GetBackupResp{EncryptedBlob: backup.EncryptedBlob}))
}
