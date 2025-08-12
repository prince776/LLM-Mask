package svc

import (
	"github.com/go-chi/render"
	"llmmask/src/common"
	"llmmask/src/confs"
	"net/http"
)

type ModelTokenPackage struct {
	ID      string
	ModelID string
	Tokens  int
	Price   string
	Popular bool
}

type GetModelPricingResp struct {
	Packages []ModelTokenPackage
}

var DefaultPackages = []ModelTokenPackage{
	{
		ModelID: confs.ModelGemini25Flash,
		Tokens:  1000,
		Price:   "$1.00",
		Popular: false,
	},
	{
		ModelID: confs.ModelGemini25Flash,
		Tokens:  5000,
		Price:   "$3.00",
		Popular: true,
	},
	{
		ModelID: confs.ModelGemini25Pro,
		Tokens:  1000,
		Price:   "$2.00",
		Popular: false,
	},
	{
		ModelID: confs.ModelGemini25Pro,
		Tokens:  5000,
		Price:   "$6.00",
		Popular: true,
	},
}

func (s *Service) GetModelPricingHandler(w http.ResponseWriter, r *http.Request) {
	packages := common.DeepCopyJSONMust(DefaultPackages)
	packages = common.Map(packages, func(p ModelTokenPackage) ModelTokenPackage {
		p.ID = p.ModelID + p.Price
		return p
	})
	render.Respond(w, r, Ok200(&GetModelPricingResp{
		Packages: packages,
	}))
}
