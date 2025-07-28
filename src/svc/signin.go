package svc

import (
	"context"
	"encoding/json"
	"io"
	"llmmask/src/common"
	"llmmask/src/log"
	"llmmask/src/models"
	"llmmask/src/secrets"
	"net/http"
	"strings"
	"time"

	"github.com/cockroachdb/errors"
	"github.com/go-chi/render"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	sessionKeyInCookie = "sessionID"
	defaultRedirectURL = "http://localhost:5173/"
)

func (s *Service) UserSignOutHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user := s.getUserFromContext(ctx)

	err := s.deleteAllExistingUserSessions(ctx, user)
	if err != nil {
		render.Render(w, r, ErrInternal(errors.Wrap(err, "failed to clear existing user sessions")))
		return
	}

	render.Render(w, r, Ok200("signed out"))
}

func (s *Service) UserSignInHandler(w http.ResponseWriter, r *http.Request) {
	// Redirect user to Google's consent page to ask for permissions
	redirectURL := common.ValueOR(
		r.URL.Query().Get("redirect"),
		defaultRedirectURL,
	)
	state := "stake-token:" + redirectURL
	url := common.UserOAuthConf().AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.AccessTypeOffline, oauth2.ApprovalForce)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (s *Service) UserOAuthCallbackHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context() // Get the authorization code from the URL
	code := r.URL.Query().Get("code")

	state := r.URL.Query().Get("state")
	parts := strings.SplitN(state, ":", 2)
	common.Assert(len(parts) == 2, "corrupted state token")
	redirectURL := parts[1]

	// Exchange the authorization code for an access token
	oauthConf := common.UserOAuthConf()
	token, err := oauthConf.Exchange(ctx, code)
	if err != nil {
		render.Render(w, r, ErrInternal(errors.Wrapf(err, "failed to exchange token")))
		return
	}

	err = s.signInUser(ctx, oauthConf, token, w)
	if err != nil {
		render.Render(w, r, ErrInternal(errors.Wrapf(err, "failed to sign in user")))
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusPermanentRedirect)
}

func (s *Service) signInUser(ctx context.Context, oauthConf *oauth2.Config, token *oauth2.Token, w http.ResponseWriter) error {
	oauthClient := oauthConf.Client(ctx, token)
	response, err := oauthClient.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		return errors.Wrapf(err, "could not get user info")
	}
	defer response.Body.Close()

	userInfoBytes, err := io.ReadAll(response.Body)
	if err != nil {
		return errors.Wrapf(err, "could not read user info resp")
	}

	userInfo := &googleUserInfoResp{}
	err = json.Unmarshal(userInfoBytes, userInfo)
	if err != nil {
		return err
	}

	tokenSerialized, err := json.Marshal(token)
	if err != nil {
		return err
	}

	tokenEncrypted, err := secrets.EncryptUserCreds(string(tokenSerialized))
	if err != nil {
		return errors.Wrap(err, "failed to encrypt user creds")
	}

	user := &models.User{
		DocID: userInfo.ID,
	}
	err = models.Fetch(ctx, user)
	if err != nil && status.Code(err) != codes.NotFound {
		return errors.Wrapf(err, "failed to check prev entry for this user in db")
	}

	user.DocID = userInfo.ID
	user.TokenSerialized = tokenEncrypted

	err = models.Upsert(ctx, user)
	if err != nil {
		return errors.Wrap(err, "failed to upsert user")
	}

	err = s.deleteAllExistingUserSessions(ctx, user)
	if err != nil {
		return errors.Wrap(err, "failed to clear user sessions")
	}

	userSession := &models.UserSession{
		DocID:     uuid.New().String(),
		UserDocID: user.DocID,
		Expired:   false,
	}

	err = models.Upsert(ctx, userSession)
	if err != nil {
		return errors.Wrapf(err, "failed to save user session")
	}

	expiration := time.Now().Add(365 * 24 * time.Hour)
	cookie := http.Cookie{
		Name:     sessionKeyInCookie,
		Value:    userSession.DocID,
		Expires:  expiration,
		Path:     "/",
		Secure:   true,
		HttpOnly: true,
	}
	http.SetCookie(w, &cookie)

	return nil
}

func (s *Service) deleteAllExistingUserSessions(ctx context.Context, user *models.User) error {
	prevSessionsIt := models.ListUserSessions(ctx, user.DocID)
	var prevSessions []*models.UserSession
	for {
		doc, err := prevSessionsIt.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return errors.Wrapf(err, "failed to iterate over prev user sessions")
		}

		userSession := &models.UserSession{}
		err = doc.DataTo(userSession)
		if err != nil {
			return err
		}
		prevSessions = append(prevSessions, userSession)
	}

	log.Infof(ctx, "Prev user sessions: %+v", prevSessions)

	for _, prevSessions := range prevSessions {
		_, err := prevSessions.DocRef().Delete(ctx)
		if err != nil {
			return errors.Wrap(err, "failed to delete prev user session")
		}
	}

	log.Infof(ctx, "Cleared all prev users sessions")
	return nil
}

type googleUserInfoResp struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}
