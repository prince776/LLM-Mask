package main

import (
	"context"
	"llmmask/src/auth"
	"llmmask/src/common"
	"llmmask/src/db"
	llm_proxy "llmmask/src/llm-proxy"
	"llmmask/src/log"
	"llmmask/src/secrets"
	"llmmask/src/svc"
	"os"
)

func Init(ctx context.Context) {
	log.Init()
	db.Init(ctx)
	secrets.Init(ctx)
	common.InitGlobalSemaphoreManager()
	log.Infof(ctx, "Initialization Done!")
}

func main() {
	ctx := context.Background()
	Init(ctx)

	gemini25FlashKeys := common.PlatformCredsConfig().Gemini25FlashAPIKeys
	gemini25FlashKeysAsSecrets := common.Map(
		gemini25FlashKeys,
		func(key string) common.SecretString {
			return common.NewSecretString(key)
		},
	)
	apiKeyManager := llm_proxy.NewAPIKeyManager(
		map[llm_proxy.ModelName][]common.SecretString{
			llm_proxy.ModelGemini25Flash: gemini25FlashKeysAsSecrets,
		},
	)
	authManagers := map[llm_proxy.ModelName]*auth.AuthManager{
		llm_proxy.ModelGemini25Flash: auth.NewAuthManager(secrets.GetGemini2FlashRSAKeys()),
	}

	server := svc.NewService(8080, authManagers, apiKeyManager)
	server.Run()
	os.Exit(0)
}
