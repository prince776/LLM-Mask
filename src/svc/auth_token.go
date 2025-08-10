package svc

import (
	"context"
	"encoding/base64"
	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
	"llmmask/src/common"
	"llmmask/src/confs"
	"llmmask/src/log"
	"llmmask/src/models"
	"net/http"
	"time"
)

func (s *Service) GetSignedBlindedTokenHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)
	req := &GetSignedBlindedTokenReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}

	resp, err := s.getSignedBlindedToken(ctx, user, req)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}
	render.Respond(w, r, Ok200(resp))
}

func (s *Service) getSignedBlindedToken(ctx context.Context, user *models.User, req *GetSignedBlindedTokenReq) (*GetSignedBlindedTokenResp, error) {
	cacheID := "getSignedBlindedToken" + req.RequestID
	if res, found := s.inMemCache.Get(cacheID); found {
		resp, ok := res.(*GetSignedBlindedTokenResp)
		common.Assert(ok, "cache misuse")
		return resp, nil
	}

	authManager, ok := s.authManagers[req.ModelName]
	if !ok {
		return nil, errors.New("no auth manager found")
	}
	sem := &common.SemaphoreConf{
		Handle:  "getSignedBlindedToken" + user.DocID,
		Request: 1,
		Limit:   1,
	}
	err := common.AcquireSemaphore(ctx, sem)
	if err != nil {
		return nil, err
	}
	defer common.ReleaseSemaphore(sem)

	err = s.dbHandler.Fetch(ctx, user)
	if err != nil {
		return nil, err
	}

	if user.SubscriptionInfo.ActiveAuthTokens == nil {
		user.SubscriptionInfo.ActiveAuthTokens = make(models.AuthTokenInfo)
	}
	if user.SubscriptionInfo.UsedAuthTokens == nil {
		user.SubscriptionInfo.UsedAuthTokens = make(models.AuthTokenInfo)
	}
	currActive := user.SubscriptionInfo.ActiveAuthTokens[req.ModelName]
	currUsed := user.SubscriptionInfo.UsedAuthTokens[req.ModelName]
	if currActive <= 0 {
		return nil, errors.New("no quota left")
	}
	currActive--
	currUsed++
	signedBlindedToken, err := authManager.SignBlindedToken(req.BlindedToken)
	if err != nil {
		return nil, err
	}
	user.SubscriptionInfo.ActiveAuthTokens[req.ModelName] = currActive
	user.SubscriptionInfo.UsedAuthTokens[req.ModelName] = currUsed
	err = s.dbHandler.Upsert(ctx, user)
	if err != nil {
		return nil, err
	}
	resp := &GetSignedBlindedTokenResp{
		ModelName:          req.ModelName,
		SignedBlindedToken: signedBlindedToken,
	}

	authToken := &models.AuthToken{
		DocID:     base64.StdEncoding.EncodeToString(req.BlindedToken),
		ModelName: req.ModelName,
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(-time.Hour * 24 * 7), // Already expired.
	}
	err = s.dbHandler.Upsert(ctx, authToken)
	if err != nil {
		return nil, err
	}
	err = s.inMemCache.Add(cacheID, resp, time.Minute*5)
	if err != nil {
		log.Errorf(ctx, "[ALERT]: Cache fill error %+v", err)
	}

	return resp, nil
}

type GetSignedBlindedTokenReq struct {
	noValidationReq
	RequestID    string
	BlindedToken []byte
	ModelName    confs.ModelName
}

type GetSignedBlindedTokenResp struct {
	ModelName          confs.ModelName
	SignedBlindedToken []byte
}
