package llm_proxy

import (
	"context"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
	"llmmask/src/confs"
)

type APIKeyManager struct {
	pool map[confs.ModelName][]common.SecretString
}

func NewAPIKeyManager(pool map[confs.ModelName][]common.SecretString) *APIKeyManager {
	return &APIKeyManager{
		pool: pool,
	}
}

func (a *APIKeyManager) GetAPIKeyForModel(ctx context.Context, modelName confs.ModelName) (common.SecretString, error) {
	keys, ok := a.pool[modelName]
	if !ok {
		return nil, errors.Newf("no api keys for model %s", modelName)
	}
	return common.RandomChoose(keys...), nil
}
