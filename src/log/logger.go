package log

import (
	"context"
	"fmt"
	"github.com/cockroachdb/errors/errbase"
	"runtime/debug"

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
	stacktrace := string(debug.Stack())
	for _, arg := range args {
		if _, ok := arg.(error); ok {
			if _, ok = arg.(errbase.StackTraceProvider); ok {
				stacktrace = fmt.Sprintf("%+v", arg)
			}
		}
	}
	logger.With("stacktrace", stacktrace).Errorf(template, args...)
}

func PanicfNoCtx(template string, args ...interface{}) {
	logger.Panicf(template, args...)
}
