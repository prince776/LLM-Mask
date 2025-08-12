package common

import (
	"encoding/json"
	"fmt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
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

func PlatformCredsConfigFile() string {
	if IsProd() {
		return "resources/prod/creds.json"
	} else {
		return "resources/dev/creds.json"
	}
}

func PlatformCredsConfig() *CredsConfig {
	data := Must(os.ReadFile(PlatformCredsConfigFile()))
	res := &CredsConfig{}
	Must2(json.Unmarshal(data, res))
	return res
}

type CredsConfig struct {
	Cosmos          *CosmosDBCredsConfig `json:"cosmos"`
	LLMAPIKeys      map[string][]string  `json:"llm_api_keys"`
	KeyVaultCreds   *KeyVaultCredsConfig `json:"key_vault_creds"`
	ModelToKeyNames map[string]string    `json:"model_to_key_names"`
}

type KeyVaultCredsConfig struct {
	TenantID     string `json:"tenant_id"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	URL          string `json:"url"`
	PlatformKey  string `json:"platform_key"`
}

type CosmosDBCredsConfig struct {
	DatabaseName     string `json:"database_name"`
	ConnectionString string `json:"connection_string"`
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
