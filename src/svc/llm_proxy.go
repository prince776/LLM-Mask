package svc

import (
	"github.com/go-chi/render"
	"net/http"
)

func (s *Service) LLMProxyHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := s.llmProxy.ServeRequest(r)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}
	render.Render(w, r, Ok200(resp))
}
