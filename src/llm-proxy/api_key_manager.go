package llm_proxy

import (
	"context"
	"github.com/cockroachdb/errors"
	"llmmask/src/common"
)

type APIKeyManager struct {
	pool map[ModelName][]common.SecretString
}

func NewAPIKeyManager(pool map[ModelName][]common.SecretString) *APIKeyManager {
	return &APIKeyManager{
		pool: pool,
	}
}

func (a *APIKeyManager) GetAPIKeyForModel(ctx context.Context, modelName ModelName) (common.SecretString, error) {
	keys, ok := a.pool[modelName]
	if !ok {
		return nil, errors.Newf("no api keys for model %s", modelName)
	}
	return common.RandomChoose(keys...), nil
}
