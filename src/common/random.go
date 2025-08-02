package common

import (
	"time"

	"math/rand"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

var letters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

func RandomString(n int) string {
	b := make([]rune, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func RandomInt(n int) int {
	Assert(n > 0, "rand requested with n <= 0: %d", n)
	return rand.Intn(n)
}

func RandomChoose[T any](t ...T) T {
	idx := RandomInt(len(t) - 1)
	return t[idx]
}
