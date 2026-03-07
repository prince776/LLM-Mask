package svc

import (
	"encoding/json"
	"github.com/go-chi/render"
	"llmmask/src/log"
	"net/http"
)

func (s *Service) LLMProxyHandler(w http.ResponseWriter, r *http.Request) {
	resp, err := s.llmProxy.ServeRequest(r)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}
	s1, _ := json.MarshalIndent(resp, "", "  ")
	log.Infof(r.Context(), "RESPONSE: %s", string(s1))
	render.Render(w, r, Ok200(resp))
}
