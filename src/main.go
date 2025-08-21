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

	llmAPIKeys := common.PlatformCredsConfig().LLMAPIKeys
	apiKeys := map[confs.ModelName][]common.SecretString{}
	for modelName, plainAPIKeys := range llmAPIKeys {
		apiKeys[modelName] = common.Map(plainAPIKeys, common.NewSecretString)
	}
	apiKeyManager := llm_proxy.NewAPIKeyManager(apiKeys)
	authManagers := map[confs.ModelName]*auth.AuthManager{
		confs.ModelGemini25Flash: auth.NewAuthManager(secrets.GetRSAKeysForModel(confs.ModelGemini25Flash)),
		confs.ModelGemini25Pro:   auth.NewAuthManager(secrets.GetRSAKeysForModel(confs.ModelGemini25Pro)),
	}

	dbHandler := models.DefaultDBHandler()

	contentModeratorConf := common.PlatformCredsConfig().ContentModeratorConfig
	contentModerator := llm_proxy.NewContentModerator(contentModeratorConf.Endpoint, contentModeratorConf.APIKey)

	server := svc.NewService(8080, authManagers, apiKeyManager, dbHandler, contentModerator)
	server.Run()
	os.Exit(0)
}
