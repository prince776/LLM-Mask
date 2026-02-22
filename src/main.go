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
	authManagers := map[confs.ModelName]*auth.AuthManager{}
	for _, modelName := range confs.AllModels() {
		authManagers[modelName] = auth.NewAuthManager(secrets.GetRSAKeysForModel(modelName))
	}
	abuseAuthMgr := auth.NewAbuseAuthManager(
		secrets.GetAbuseRSAKeys(confs.AbuseKeyPermanent),
		secrets.GetAbuseRSAKeys(confs.AbuseKeyTransient),
	)

	dbHandler := models.DefaultDBHandler()

	contentModeratorConf := common.PlatformCredsConfig().ContentModeratorConfig
	contentModerator := llm_proxy.NewContentModerator(contentModeratorConf.Endpoint, contentModeratorConf.APIKey, dbHandler)

	kms := secrets.DefaultKMS()
	server := svc.NewService(8080, authManagers, abuseAuthMgr, apiKeyManager, dbHandler, contentModerator, kms)
	server.Run()
	os.Exit(0)
}
