package common

import (
	"encoding/json"
	"fmt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"os"
	"sync"
)

const (
	DepEnvKey = "DEPLOYMENT"
)

func APIServerBaseURL() string {
	if IsProd() {
		panic("unimplemented")
	} else {
		return "http://localhost:8080"
	}
}

func IsProd() bool {
	env := os.Getenv(DepEnvKey)
	return env == "PROD"
}

func PlatformSACredsFile() string {
	if IsProd() {
		return "resources/prod/gcp-sa.json"
	} else {
		return "resources/dev/gcp-sa.json"
	}
}

func PlatformSvcAccCredsOption() option.ClientOption {
	return option.WithCredentialsFile(PlatformSACredsFile())
}

var userOauthConf *oauth2.Config
var userOauthConfOnce sync.Once

func UserOAuthConf() *oauth2.Config {
	userOauthConfOnce.Do(func() {
		fileName := "resources/dev/user-oauth-conf.json"
		if IsProd() {
			fileName = "resources/prod/user-oauth-conf.json"
		}
		file := Must(os.ReadFile(fileName))

		res := &oauth2.Config{}
		Must2(json.Unmarshal(file, &res))
		res.Endpoint = google.Endpoint
		res.RedirectURL = fmt.Sprintf("%s/api/v1/users/grantGCP/callback", APIServerBaseURL())
		res.Scopes = []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		}
		userOauthConf = res
	})

	return userOauthConf
}
