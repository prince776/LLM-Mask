package log

import (
	"context"

	"go.uber.org/zap"
)

var logger *zap.SugaredLogger

func Init() {
	devLogger, _ := zap.NewDevelopment(zap.AddCallerSkip(1))
	defer devLogger.Sync()
	logger = devLogger.Sugar()
}

func InternalLogger() *zap.SugaredLogger {
	return logger
}

func Infof(ctx context.Context, template string, args ...interface{}) {
	logger.Infof(template, args...)
}

func Errorf(ctx context.Context, template string, args ...interface{}) {
	logger.Errorf(template, args...)
}

func PanicfNoCtx(template string, args ...interface{}) {
	logger.Panicf(template, args...)
}
