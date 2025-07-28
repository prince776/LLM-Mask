package svc

import (
	"bytes"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
	"io"
	"llmmask/src/relay"
	"llmmask/src/secrets"
	"net/http"
	"net/url"
)

func (s *Service) GetPublicKeyHandler(w http.ResponseWriter, r *http.Request) {
	rsaKeys := secrets.GetEphemeralRSAKeys()
	publicKeyBytes, err := x509.MarshalPKIXPublicKey(rsaKeys.PublicKey)
	if err != nil {
		render.Render(w, r, ErrInternal(errors.Wrap(err, "failed to marshal public key")))
		return
	}
	render.Render(w, r, Ok200(publicKeyBytes))
}

func (s *Service) RelayMessageHandler(w http.ResponseWriter, r *http.Request) {
	rsaKeys := secrets.GetEphemeralRSAKeys()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	unwrappedBody, err := secrets.RSADecrypt(rsaKeys.PrivateKey, body)
	if err != nil {
		render.Render(w, r, ErrInternal(errors.Wrap(err, "failed to unwrap body")))
		return
	}

	msg := &relay.Message{}
	if err := json.Unmarshal(unwrappedBody, msg); err != nil {
		render.Render(w, r, ErrInternal(err))
		return
	}

	switch msg.Action {
	case relay.ActionCallLLM:
		panic("not implemented")
	case relay.ActionForwardMsg:
		bodyForNextServer := bytes.NewReader(msg.Data)
		nextURL := url.URL{
			Scheme: "https", // Only support https for security.
			Host:   msg.ForwardingInfo.Host,
			Path:   "/api/v1/relay/relayMsg",
		}
		resp, err := http.Post(nextURL.RequestURI(), "application/json", bodyForNextServer)
		if err != nil {
			render.Render(w, r, ErrInternal(errors.Wrap(err, "failed to post to next server")))
			return
		}

		// Proxy the response.
		w.WriteHeader(resp.StatusCode)
		for name, values := range resp.Header {
			// TODO: Filter some headers?
			for _, value := range values {
				w.Header().Add(name, value)
			}
		}
		_, err = io.Copy(w, resp.Body)
		if err != nil {
			render.Render(w, r, ErrInternal(errors.Wrap(err, "failed to copy response body")))
			return
		}
		return
	default:
		render.Render(w, r, ErrInternal(fmt.Errorf("unknown action: %s", msg.Action)))
	}
}
