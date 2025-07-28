package common

func ValueOR[T comparable](vals ...T) T {
	var defaultVal T
	for _, val := range vals {
		if val != defaultVal {
			return val
		}
	}
	return defaultVal
}
