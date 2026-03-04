package svc

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"llmmask/src/models"
)

const maxFeedbackMessageBytes = 2000

// PostFeedbackReq is the request body for posting a user message.
type PostFeedbackReq struct {
	noValidationReq
	Message string `json:"message"`
}

// GetFeedbackResp is the response body for the user's thread.
type GetFeedbackResp struct {
	Entries []models.ThreadEntry `json:"entries"`
}

// AdminGetFeedbackResp is the response body for the admin thread list.
type AdminGetFeedbackResp struct {
	Threads []*models.FeedbackThread `json:"threads"`
}

// AdminReplyFeedbackReq is the request body for admin replies.
type AdminReplyFeedbackReq struct {
	noValidationReq
	Reply string `json:"reply"`
}

// GetFeedbackHandler returns the authenticated user's thread entries.
// GET /api/v1/feedback (auth required)
func (s *Service) GetFeedbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	thread := &models.FeedbackThread{DocID: user.DocID}
	if err := s.dbHandler.Fetch(ctx, thread); err != nil {
		if models.IsNotFoundErr(err) {
			render.Render(w, r, Ok200(&GetFeedbackResp{Entries: []models.ThreadEntry{}}))
			return
		}
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(&GetFeedbackResp{Entries: thread.Entries}))
}

// PostFeedbackHandler appends a user message to their thread, creating it if needed.
// POST /api/v1/feedback (auth required)
func (s *Service) PostFeedbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	req := &PostFeedbackReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}
	if req.Message == "" {
		render.Render(w, r, ErrInvalidRequest(errors.New("message is required")))
		return
	}
	if len(req.Message) > maxFeedbackMessageBytes {
		render.Render(w, r, ErrInvalidRequest(errors.Newf("message too long: max %d characters", maxFeedbackMessageBytes)))
		return
	}

	now := time.Now().UTC()
	entry := models.ThreadEntry{Role: "user", Content: req.Message, CreatedAt: now}

	thread := &models.FeedbackThread{DocID: user.DocID}
	if err := s.dbHandler.Fetch(ctx, thread); err != nil {
		if !models.IsNotFoundErr(err) {
			render.Render(w, r, ErrInternal(err))
			return
		}
		// First message — create thread
		thread = &models.FeedbackThread{
			DocID:     user.DocID,
			UserDocID: user.DocID,
			UserEmail: user.Email,
			UserName:  user.Name,
			Status:    "open",
			Entries:   []models.ThreadEntry{entry},
			CreatedAt: now,
			UpdatedAt: now,
		}
	} else {
		thread.Entries = append(thread.Entries, entry)
		thread.Status = "open"
		thread.UpdatedAt = now
	}

	if err := s.dbHandler.Upsert(ctx, thread); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(nil))
}

// AdminGetFeedbackHandler lists all feedback threads, open first then by UpdatedAt desc.
// GET /api/v1/admin/feedback (admin key required)
func (s *Service) AdminGetFeedbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	items, err := s.dbHandler.Query(ctx, models.FeedbackContainer, "SELECT * FROM c")
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	threads := make([]*models.FeedbackThread, 0, len(items))
	for _, item := range items {
		var t models.FeedbackThread
		if err := json.Unmarshal(item, &t); err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}
		threads = append(threads, &t)
	}
	sort.Slice(threads, func(i, j int) bool {
		if threads[i].Status != threads[j].Status {
			return threads[i].Status == "open"
		}
		return threads[i].UpdatedAt.After(threads[j].UpdatedAt)
	})

	render.Render(w, r, Ok200(&AdminGetFeedbackResp{Threads: threads}))
}

// AdminReplyFeedbackHandler appends an admin message to a user's thread.
// POST /api/v1/admin/feedback/{id}/reply (admin key required)
// {id} is the UserDocID (same as thread DocID).
func (s *Service) AdminReplyFeedbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	req := &AdminReplyFeedbackReq{}
	if err := render.Bind(r, req); err != nil {
		render.Render(w, r, ErrInvalidRequest(err))
		return
	}
	if req.Reply == "" {
		render.Render(w, r, ErrInvalidRequest(errors.New("reply is required")))
		return
	}

	thread := &models.FeedbackThread{DocID: id}
	if err := s.dbHandler.Fetch(ctx, thread); err != nil {
		if models.IsNotFoundErr(err) {
			render.Render(w, r, ErrNotFound())
			return
		}
		render.Render(w, r, ErrInternal(err))
		return
	}

	now := time.Now().UTC()
	thread.Entries = append(thread.Entries, models.ThreadEntry{
		Role:      "admin",
		Content:   req.Reply,
		CreatedAt: now,
	})
	thread.Status = "replied"
	thread.UpdatedAt = now

	if err := s.dbHandler.Upsert(ctx, thread); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	render.Render(w, r, Ok200(nil))
}
