package common

import (
	"context"
	"llmmask/src/log"
)

func Assert(condition bool, msg string, args ...interface{}) {
	if !condition {
		log.Errorf(context.Background(), "ASSERT FAILURE: %s", msg)
		log.PanicfNoCtx(msg, args...)
	}
}

func Must[T any](t T, err error) T {
	Assert(err == nil, "Must failed, err: %v ", err)
	return t
}

func Must2(err error) {
	Must(1, err)
}
