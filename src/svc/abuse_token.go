package svc

import (
	"github.com/go-chi/render"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/models"
	"net/http"
	"time"
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
func (s *Service) IssuePermanentAbuseTokenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	req := &IssueAbuseTokenReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
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
		render.Render(w, r, &ErrResponse{
			HTTPStatusCode: 409,
			StatusText:     "Conflict",
			ErrorText:      "permanent abuse token already issued for this account",
		})
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
// Each user may only obtain one transient token per calendar-month epoch.
func (s *Service) IssueTransientAbuseTokenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	req := &IssueAbuseTokenReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
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
		render.Render(w, r, &ErrResponse{
			HTTPStatusCode: 409,
			StatusText:     "Conflict",
			ErrorText:      "transient abuse token already issued for this epoch",
		})
		return
	}

	signed, err := s.abuseAuthManager.SignTransientBlindedToken(req.BlindedToken)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	user.TransientAbuseTokenEpoch = currentEpoch
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

