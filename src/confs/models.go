package confs

type ModelName = string

const (
	ModelGemini25Flash = "gemini-2.5-flash"
	ModelGemini25Pro   = "gemini-2.5-pro"
)

func AllModels() []ModelName {
	return []ModelName{
		ModelGemini25Flash,
		ModelGemini25Pro,
	}
}
