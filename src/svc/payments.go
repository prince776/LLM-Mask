package svc

import (
	"fmt"
	"github.com/cockroachdb/errors"
	"net/http"

	"github.com/dodopayments/dodopayments-go"
	"github.com/dodopayments/dodopayments-go/option"
	"github.com/go-chi/render"
	"llmmask/src/common"
	"llmmask/src/log"
)

type GetModelPricingResp struct {
	Packages []common.ModelTokenPackage
}

func (s *Service) GetModelPricingHandler(w http.ResponseWriter, r *http.Request) {
	packages := common.DeepCopyJSONMust(common.PlatformCredsConfig().ModelPackages)
	packages = common.Map(packages, func(p common.ModelTokenPackage) common.ModelTokenPackage {
		p.ID = p.ModelID + p.Price
		return p
	})
	render.Respond(w, r, Ok200(&GetModelPricingResp{
		Packages: packages,
	}))
}

func (s *Service) getPackageForProductID(productID string) *common.ModelTokenPackage {
	for _, pkg := range common.PlatformCredsConfig().ModelPackages {
		if pkg.DodoProductID == productID {
			return &pkg
		}
	}
	return nil
}

func (s *Service) PaymentCallbackHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html><html><head><title>Payment Complete</title></head><body>
<script>window.close();</script>
<p>Payment complete. You can close this window.</p>
</body></html>`))
}

func (s *Service) PurchaseHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID := r.URL.Query().Get("userID")
	transientToken := r.URL.Query().Get("transientToken")
	productID := r.URL.Query().Get("dodoProductID")
	redirectURL := r.URL.Query().Get("redirectURL")

	tokenPackage := s.getPackageForProductID(productID)
	if tokenPackage == nil {
		render.Render(w, r, ErrNotFound())
		return
	}

	log.Infof(ctx, "Executing purchase: userID=%s, productID=%s", userID, productID)

	user, err := s.getUserFromDocID(ctx, userID)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	expectedTransientToken := s.getTransientUserToken(userID)
	if expectedTransientToken != transientToken {
		render.Render(w, r, ErrUnauthorized(errors.New("transient token does not match")))
		return
	}

	dodoCreds := common.PlatformCredsConfig().DodoPaymentsCreds
	envOpt := option.WithEnvironmentTestMode()
	if dodoCreds.Environment == "live_mode" {
		envOpt = option.WithEnvironmentLiveMode()
	}
	client := dodopayments.NewClient(
		option.WithBearerToken(dodoCreds.APIKey),
		envOpt,
	)

	customerName := user.Name
	if customerName == "" {
		customerName = user.Email
	}

	session, err := client.CheckoutSessions.New(ctx, dodopayments.CheckoutSessionNewParams{
		CheckoutSessionRequest: dodopayments.CheckoutSessionRequestParam{
			ProductCart: dodopayments.F([]dodopayments.ProductItemReqParam{
				{
					ProductID: dodopayments.F(productID),
					Quantity:  dodopayments.F(int64(1)),
				},
			}),
			Customer: dodopayments.F[dodopayments.CustomerRequestUnionParam](dodopayments.NewCustomerParam{
				Email: dodopayments.F(user.Email),
				Name:  dodopayments.F(customerName),
			}),
			Metadata: dodopayments.F(map[string]string{
				customDataUserIDKey: userID,
			}),
			ReturnURL: dodopayments.F(redirectURL),
		},
	})
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	log.Infof(ctx, "Created DodoPayments checkout session %s for user %s (%s %s credits)",
		session.SessionID, userID, fmt.Sprintf("%v", tokenPackage.Tokens), tokenPackage.ModelID)

	http.Redirect(w, r, session.CheckoutURL, http.StatusSeeOther)
}
