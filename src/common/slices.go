package common

func Filter[S ~[]E, E any](arr S, filter func(E) bool) S {
	if arr == nil {
		return nil
	}

	res := []E{}
	for _, e := range arr {
		if filter(e) {
			res = append(res, e)
		}
	}
	return res
}
