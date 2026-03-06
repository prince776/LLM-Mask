package llm_proxy

import (
	"context"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"llmmask/src/confs"
)

type APIKeyManager struct {
	pool      map[confs.ModelName][]common.SecretString
	endpoints map[confs.ModelName]string
}

func NewAPIKeyManager(pool map[confs.ModelName][]common.SecretString, endpoints map[confs.ModelName]string) *APIKeyManager {
	return &APIKeyManager{
		pool:      pool,
		endpoints: endpoints,
	}
}

func (a *APIKeyManager) GetAPIKeyForModel(ctx context.Context, modelName confs.ModelName) (common.SecretString, error) {
	keys, ok := a.pool[modelName]
	if !ok {
		return nil, errors.Newf("no api keys for model %s", modelName)
	}
	return common.RandomChoose(keys...), nil
}

func (a *APIKeyManager) GetEndpointForModel(modelName confs.ModelName) (string, error) {
	endpoint, ok := a.endpoints[modelName]
	if !ok {
		return "", errors.Newf("no endpoint for model %s", modelName)
	}
	return endpoint, nil
}
