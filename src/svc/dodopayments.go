package svc

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/cockroachdb/errors"
	"github.com/dodopayments/dodopayments-go"
	"github.com/dodopayments/dodopayments-go/option"
	"github.com/go-chi/render"
	"llmmask/src/common"
	"llmmask/src/log"
	"llmmask/src/models"
)

const (
	customDataUserIDKey = "userID"
)

type dodoWebhookEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type dodoPaymentData struct {
	PaymentID   string            `json:"payment_id"`
	Metadata    map[string]string `json:"metadata"`
	ProductCart []struct {
		ProductID string `json:"product_id"`
		Quantity  int    `json:"quantity"`
	} `json:"product_cart"`
}

func (s *Service) DodoWebHookHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	body, err := io.ReadAll(r.Body)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	dodoCreds := common.PlatformCredsConfig().DodoPaymentsCreds
	client := dodopayments.NewClient(
		option.WithBearerToken(dodoCreds.APIKey),
	)
	_, err = client.Webhooks.Unwrap(body, r.Header, option.WithWebhookKey(dodoCreds.WebhookKey))
	if err != nil {
		render.Render(w, r, ErrUnauthorized(errors.Wrapf(err, "failed to verify webhook signature")))
		return
	}

	event := &dodoWebhookEvent{}
	if err = json.Unmarshal(body, event); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	if event.Type == "payment.succeeded" {
		payment := &dodoPaymentData{}
		if err = json.Unmarshal(event.Data, payment); err != nil {
			render.Render(w, r, ErrInternal(err))
			return
		}

		log.Infof(ctx, "Handling payment.succeeded event: %s", payment.PaymentID)

		userID, ok := payment.Metadata[customDataUserIDKey]
		if !ok || userID == "" {
			render.Render(w, r, ErrInternal(errors.New("missing userID in payment metadata")))
			return
		}

		log.Infof(ctx, "Processing payment for user: %s", userID)

		for _, item := range payment.ProductCart {
			tokenPackage := s.getPackageForProductID(item.ProductID)
			if tokenPackage == nil {
				log.Infof(ctx, "Unknown product ID in payment %s: %s", payment.PaymentID, item.ProductID)
				continue
			}

			modelID := tokenPackage.ModelID
			totalCreditsPurchased := item.Quantity * tokenPackage.Tokens
			log.Infof(ctx, "User %s purchased %d credits for model %s", userID, totalCreditsPurchased, modelID)

			user, err := s.getUserFromDocID(ctx, userID)
			if err != nil {
				render.Render(w, r, ErrInternal(err))
				return
			}
			if user.SubscriptionInfo.ActiveAuthTokens == nil {
				user.SubscriptionInfo.ActiveAuthTokens = make(map[string]int)
			}
			user.SubscriptionInfo.ActiveAuthTokens[modelID] += totalCreditsPurchased
			user.SubscriptionInfo.PaymentLogs = append(user.SubscriptionInfo.PaymentLogs, models.PaymentLog{
				TransactionID: payment.PaymentID,
				TokensGranted: map[string]int{modelID: totalCreditsPurchased},
			})

			if err = s.dbHandler.Upsert(ctx, user); err != nil {
				render.Render(w, r, ErrInternal(err))
				return
			}
		}
	} else {
		log.Infof(ctx, "Skipping webhook event: %s", event.Type)
	}

	render.Render(w, r, Ok200("ok"))
}
