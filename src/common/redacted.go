package common

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type Redactable interface {
	ToRedacted() Redactable
}

func DeepCopyJSON[T any](input T) (T, error) {
	var copied T
	buf := new(bytes.Buffer)
	if err := json.NewEncoder(buf).Encode(input); err != nil {
		return copied, fmt.Errorf("failed to encode input: %w", err)
	}

	// Deserialize JSON back into a new object
	if err := json.NewDecoder(buf).Decode(&copied); err != nil {
		return copied, fmt.Errorf("failed to decode into copy: %w", err)
	}

	return copied, nil
}

func DeepCopyJSONMust[T any](input T) T {
	res, err := DeepCopyJSON(input)
	Assert(err == nil, "err non nil when deep copying json: %v", err)
	return res
}
