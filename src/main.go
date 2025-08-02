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

	geminiKey := os.Getenv("GEMINI_API_KEY")
	apiKeyManager := llm_proxy.NewAPIKeyManager(
		map[llm_proxy.ModelName][]common.SecretString{
			llm_proxy.ModelGemini25Flash: {
				common.NewSecretString(geminiKey),
			},
		},
	)
	authManagers := map[llm_proxy.ModelName]*auth.AuthManager{
		llm_proxy.ModelGemini25Flash: auth.NewAuthManager(secrets.GetGemini2FlashRSAKeys()),
	}

	server := svc.NewService(8080, db.Client(), authManagers, apiKeyManager)
	server.Run()
	os.Exit(0)
}
