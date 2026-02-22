package common

import (
	"encoding/json"
	"fmt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"os"
	"strings"
	"sync"
)

const (
	DepEnvKey        = "DEPLOYMENT"
	APIBaseURLEnvKey = "API_BASE_URL"
)

func APIServerBaseURL() string {
	if baseURL := strings.TrimSpace(os.Getenv(APIBaseURLEnvKey)); baseURL != "" {
		return strings.TrimRight(baseURL, "/")
	}

	if IsProd() {
		return "https://api.llmtor.com"
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
	// TODO: Cache and clear.
	var data []byte
	if !IsProd() {
		data = Must(os.ReadFile(PlatformCredsConfigFile()))
	} else {
		data = []byte(os.Getenv("PROD_CREDENTIALS_CONFIG"))
	}
	res := &CredsConfig{}
	Must2(json.Unmarshal(data, res))
	return res
}

type CredsConfig struct {
	Cosmos                 *CosmosDBCredsConfig    `json:"cosmos"`
	LLMAPIKeys             map[string][]string     `json:"llm_api_keys"`
	KeyVaultCreds          *KeyVaultCredsConfig    `json:"key_vault_creds"`
	ContentModeratorConfig *ContentModeratorConfig `json:"content_moderator_config"`
	UserOAuthCreds         *UserOAuthCreds         `json:"user_oauth_creds"`
	DodoPaymentsCreds      *DodoPaymentsCreds      `json:"dodo_payments_creds"`
	ModelPackages          []ModelTokenPackage     `json:"model_packages"`
	AdminAPIKey            string                  `json:"admin_api_key"`
}

type DodoPaymentsCreds struct {
	APIKey      string `json:"api_key"`
	WebhookKey  string `json:"webhook_key"`
	Environment string `json:"environment"` // "test_mode" or "live_mode"
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

type ContentModeratorConfig struct {
	Endpoint string `json:"endpoint"`
	APIKey   string `json:"api_key"`
}

type UserOAuthCreds struct {
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
}

type ModelTokenPackage struct {
	ID            string `json:"ID,omitempty"`
	ModelID       string `json:"ModelID"`
	Tokens        int    `json:"Tokens"`
	Price         string `json:"Price"`
	Popular       bool   `json:"Popular"`
	DodoProductID string `json:"DodoProductID,omitempty"`
}

var userOauthConf *oauth2.Config
var userOauthConfOnce sync.Once

func UserOAuthConf() *oauth2.Config {
	userOauthConfOnce.Do(func() {
		oauthCreds := PlatformCredsConfig().UserOAuthCreds
		res := &oauth2.Config{}
		res.ClientID = oauthCreds.ClientID
		res.ClientSecret = oauthCreds.ClientSecret
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
