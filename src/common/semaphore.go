package common

import (
	"context"
	"golang.org/x/sync/semaphore"
	"llmmask/src/log"
	"sync"
)

type SemaphoreConf struct {
	Handle  string
	Request int64
	Limit   int64
}

type SemaphoreManager struct {
	sync.Mutex
	handles map[string]*semaphore.Weighted
}

var globalSemaphoreManager *SemaphoreManager

func InitGlobalSemaphoreManager() {
	globalSemaphoreManager = &SemaphoreManager{
		Mutex:   sync.Mutex{},
		handles: make(map[string]*semaphore.Weighted),
	}
}

func AcquireSemaphore(ctx context.Context, conf *SemaphoreConf) error {
	globalSemaphoreManager.Lock()

	log.Infof(ctx, "Acquiring semaphore: %+v", conf)
	defer log.Infof(ctx, "Acquired semaphore: %+v", conf)

	sem, ok := globalSemaphoreManager.handles[conf.Handle]
	if ok {
		globalSemaphoreManager.Unlock()
		return sem.Acquire(ctx, conf.Request)
	}
	globalSemaphoreManager.handles[conf.Handle] = semaphore.NewWeighted(conf.Limit)
	sem = globalSemaphoreManager.handles[conf.Handle]
	globalSemaphoreManager.Unlock()

	return sem.Acquire(ctx, conf.Request)
}

func ReleaseSemaphore(conf *SemaphoreConf) {
	globalSemaphoreManager.Lock()

	sem, ok := globalSemaphoreManager.handles[conf.Handle]
	Assert(ok, "Releasing semaphore without acquiring: %+v", conf)
	globalSemaphoreManager.Unlock()

	sem.Release(conf.Request)
}

func BinarySemaphoreConf(handle string) *SemaphoreConf {
	return &SemaphoreConf{
		Handle:  handle,
		Request: 1,
		Limit:   1,
	}
}
