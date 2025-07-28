package common

import (
	"context"
	"llmmask/src/log"
	"runtime/debug"
)

func Assert(condition bool, msg string, args ...interface{}) {
	if !condition {
		log.Errorf(context.Background(), "ASSERT FAILURE: %s", msg)
		log.PanicfNoCtx(msg, args...)
	}
}

func Must[T any](t T, err error) T {
	Assert(err == nil, "Must failed st: %+v", debug.Stack())
	return t
}

func Must2(err error) {
	Must(1, err)
}
