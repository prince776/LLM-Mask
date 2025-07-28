package main

import (
	"context"
	"llmmask/src/common"
	"llmmask/src/db"
	"llmmask/src/log"
	"llmmask/src/svc"
	"os"
)

func Init(ctx context.Context) {
	log.Init()
	db.Init(ctx)
	common.InitGlobalSemaphoreManager()
	log.Infof(ctx, "Initialization Done!")
}

func main() {
	ctx := context.Background()
	Init(ctx)

	server := svc.NewService(8080, db.Client())
	server.Run()
	os.Exit(0)
}
