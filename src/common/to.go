package common

func ToPtr[T any](val T) *T {
	return &val
}

func PtrVal[T any](ptr *T, defaultVal T) T {
	if ptr == nil {
		return defaultVal
	}
	return *ptr
}
