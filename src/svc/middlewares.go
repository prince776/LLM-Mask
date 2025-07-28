package svc

import (
	"context"
	"github.com/go-chi/httprate"
	"llmmask/src/common"
	"llmmask/src/models"
	"net/http"
	"strconv"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
)

type contextKey string

const userContextKey contextKey = "authenticatedUser"
const userSessionIDCtxKey contextKey = "authenticatedUserSessionID"

func (s *Service) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionKeyInCookie)
		if err != nil && !errors.Is(err, http.ErrNoCookie) {
			render.Render(w, r, ErrUnauthorized(errors.Wrap(err, "failed to get cookies")))
			return
		}

		sessionID := cookie.Value
		user, err := s.getUserFromSession(r.Context(), sessionID)
		if err != nil || user == nil {
			render.Render(w, r, ErrUnauthorized(errors.Wrapf(err, "failed to get user form session")))
			return
		}
		// Store user info in context
		ctx := context.WithValue(r.Context(), userContextKey, user)
		ctx = context.WithValue(ctx, userSessionIDCtxKey, sessionID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Service) SemaphoreMiddleware(semaphoreConf *common.SemaphoreConf) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			err := common.AcquireSemaphore(ctx, semaphoreConf)
			if err != nil {
				render.Render(w, r, ErrInternal(err))
				return
			}
			defer common.ReleaseSemaphore(semaphoreConf)

			next.ServeHTTP(w, r)
		})
	}
}

func (s *Service) getUserFromSession(ctx context.Context, sessionID string) (*models.User, error) {
	userSession := &models.UserSession{
		DocID: sessionID,
	}
	err := models.Fetch(ctx, userSession)
	if err != nil {
		return nil, err
	}

	user, err := s.getUserFromDocID(ctx, userSession.UserDocID)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (s *Service) getUserFromDocID(ctx context.Context, docID string) (*models.User, error) {
	user := &models.User{}
	err := models.Fetch(ctx, user)
	if err != nil {
		return nil, err
	}

	return user, nil
}

func (s *Service) RateLimitByUserMiddleware(limit int) func(http.Handler) http.Handler {
	return httprate.Limit(
		limit,
		time.Second,
		httprate.WithKeyFuncs(func(r *http.Request) (string, error) {
			cookie, err := r.Cookie(sessionKeyInCookie)
			if err == nil {
				return cookie.Value, nil
			}

			// Anonymous users combined will have a rate limit of 10x a authenticated user
			return "anon-" + strconv.Itoa(common.RandomInt(10)), nil
		}),
	)
}
