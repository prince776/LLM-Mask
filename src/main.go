package main

import (
	"context"
	"llmmask/src/auth"
	"llmmask/src/common"
	"llmmask/src/confs"
	llm_proxy "llmmask/src/llm-proxy"
	"llmmask/src/log"
	"llmmask/src/models"
	"llmmask/src/secrets"
	"llmmask/src/svc"
	"os"
)

func Init(ctx context.Context) {
	log.Init()
	models.Init(ctx)
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
		map[confs.ModelName][]common.SecretString{
			confs.ModelGemini25Flash: gemini25FlashKeysAsSecrets,
		},
	)
	authManagers := map[confs.ModelName]*auth.AuthManager{
		confs.ModelGemini25Flash: auth.NewAuthManager(secrets.GetRSAKeysForModel(confs.ModelGemini25Flash)),
	}

	dbHandler := models.DefaultDBHandler()
	server := svc.NewService(8080, authManagers, apiKeyManager, dbHandler)
	server.Run()
	os.Exit(0)
}
