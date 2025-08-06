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

func Map[S ~[]E, E, R any](arr S, mapFunc func(E) R) []R {
	if arr == nil {
		return nil
	}
	var res []R
	for _, e := range arr {
		res = append(res, mapFunc(e))
	}
	return res
}
