package svc

import (
	_ "embed"
	"net/http"
)

//go:embed demo.html
var demoHTML []byte

func (s *Service) DemoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write(demoHTML)
}
