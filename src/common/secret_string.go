package common

type _secret_lock struct{}

type SecretString func(_secret_lock) string

func NewSecretString(val string) SecretString {
	return func(_secret_lock) string {
		return val
	}
}

func (s SecretString) UnsafeString() string {
	return s(_secret_lock{})
}

func (s SecretString) String() string {
	return "<secret>"
}
