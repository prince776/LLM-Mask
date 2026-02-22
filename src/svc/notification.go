package svc

import (
	"llmmask/src/common"
	"llmmask/src/models"
	"net/http"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
)

// GetNotificationsResp is the response body for fetching notifications.
type GetNotificationsResp struct {
	Global *models.Notification `json:"global"`
	User   *models.Notification `json:"user"`
}

// AdminSetNotificationReq is the request body for setting a notification.
type AdminSetNotificationReq struct {
	noValidationReq
	Type    string `json:"type"`    // "global" or "user"
	UserID  string `json:"userID"`  // required when type == "user"
	Message string `json:"message"`
}

// AdminDeleteNotificationReq is the request body for deleting a notification.
type AdminDeleteNotificationReq struct {
	noValidationReq
	Type   string `json:"type"`   // "global" or "user"
	UserID string `json:"userID"` // required when type == "user"
}

// GetNotificationsHandler returns global and user-specific notifications.
// GET /api/v1/notifications (auth required)
func (s *Service) GetNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	resp := &GetNotificationsResp{}

	globalNotif := &models.Notification{DocID: "global"}
	if err := s.dbHandler.Fetch(ctx, globalNotif); err != nil {
		if !models.IsNotFoundErr(err) {
			render.Render(w, r, ErrInternal(err))
			return
		}
	} else {
		resp.Global = globalNotif
	}

	userNotif := &models.Notification{DocID: user.DocID}
	if err := s.dbHandler.Fetch(ctx, userNotif); err != nil {
		if !models.IsNotFoundErr(err) {
			render.Render(w, r, ErrInternal(err))
			return
		}
	} else {
		resp.User = userNotif
	}

	render.Render(w, r, Ok200(resp))
}

// AdminSetNotificationHandler upserts a global or user-specific notification.
// POST /api/v1/admin/notification (admin key required)
func (s *Service) AdminSetNotificationHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := &AdminSetNotificationReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}

	if req.Message == "" {
		render.Render(w, r, ErrInvalidRequest(errors.New("message is required")))
		return
	}

	var docID string
	switch req.Type {
	case "global":
		docID = "global"
	case "user":
		if req.UserID == "" {
			render.Render(w, r, ErrInvalidRequest(errors.New("userID is required for user notifications")))
			return
		}
		docID = req.UserID
	default:
		render.Render(w, r, ErrInvalidRequest(errors.Newf("invalid type %q: must be 'global' or 'user'", req.Type)))
		return
	}

	notif := &models.Notification{
		DocID:     docID,
		Message:   req.Message,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.dbHandler.Upsert(ctx, notif); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(nil))
}

// AdminDeleteNotificationHandler deletes a global or user-specific notification.
// DELETE /api/v1/admin/notification (admin key required)
func (s *Service) AdminDeleteNotificationHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	req := &AdminDeleteNotificationReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}

	var docID string
	switch req.Type {
	case "global":
		docID = "global"
	case "user":
		if req.UserID == "" {
			render.Render(w, r, ErrInvalidRequest(errors.New("userID is required for user notifications")))
			return
		}
		docID = req.UserID
	default:
		render.Render(w, r, ErrInvalidRequest(errors.Newf("invalid type %q: must be 'global' or 'user'", req.Type)))
		return
	}

	notif := &models.Notification{DocID: docID}
	if err := s.dbHandler.Delete(ctx, notif); err != nil {
		if models.IsNotFoundErr(err) {
			render.Render(w, r, Ok200(nil))
			return
		}
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(nil))
}

// adminKeyMiddleware checks the X-Admin-Key header against the admin_api_key from creds config.
func (s *Service) adminKeyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		adminKey := common.PlatformCredsConfig().AdminAPIKey
		if adminKey == "" || r.Header.Get("X-Admin-Key") != adminKey {
			render.Render(w, r, ErrUnauthorized(errors.New("invalid or missing admin key")))
			return
		}
		next.ServeHTTP(w, r)
	})
}
