package svc

import (
	"context"
	"llmmask/src/common"
	"llmmask/src/models"
	"net/http"

	"github.com/go-chi/render"
)

func (s *Service) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)
	render.Render(w, r, Ok200(user))
}

func (svc *Service) getUserFromContext(ctx context.Context) *models.User {
	user, ok := ctx.Value(userContextKey).(*models.User)
	common.Assert(ok, "user not in context")
	return user
}
