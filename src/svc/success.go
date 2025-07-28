package svc

import (
	"llmmask/src/common"
	"net/http"

	"github.com/go-chi/render"
)

type SuccessResp struct {
	HTTPStatusCode int `json:"-"` // http response status code

	StatusText string      `json:"status"` // user-level status message
	Data       interface{} `json:"data"`
}

func (s *SuccessResp) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, s.HTTPStatusCode)
	return nil
}

func Ok200(data interface{}) *SuccessResp {
	finalData := data
	if redactable, ok := data.(common.Redactable); ok {
		finalData = redactable.ToRedacted()
	}
	return &SuccessResp{
		HTTPStatusCode: 200,
		StatusText:     "Ok.",
		Data:           finalData,
	}
}
