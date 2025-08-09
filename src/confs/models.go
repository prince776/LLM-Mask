package confs

type ModelName = string

const (
	ModelGemini25Flash = "gemini-2.5-flash"
)

func AllModels() []ModelName {
	return []ModelName{
		ModelGemini25Flash,
	}
}
