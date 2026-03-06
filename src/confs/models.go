package confs

type ModelName = string

const (
	// Google
	ModelGemini25FlashLite = "gemini-2.5-flash-lite"
	ModelGemini25Flash     = "gemini-2.5-flash"
	ModelGemini25Pro       = "gemini-2.5-pro"
	ModelGemini3Flash      = "gemini-3-flash-preview"
	ModelGemini3Pro        = "gemini-3-pro-preview"

	// OpenAI
	ModelChatGPT41     = "gpt-4.1"
	ModelChatGPT41Mini = "gpt-4.1-mini"
	ModelChatGPT4o     = "gpt-4o"
	ModelChatGPTo1     = "o1"
	ModelChatGPT53     = "gpt-5.3-chat"
	ModelChatGPT5Mini  = "gpt-5-mini"
)

func AllModels() []ModelName {
	return []ModelName{
		// Google
		// ModelGemini25FlashLite, // redundant: weaker than flash, 3-flash also available
		ModelGemini25Flash,
		ModelGemini25Pro,
		// ModelGemini3Flash, // preview: unstable for production
		// ModelGemini3Pro,   // deprecated by Google, shutting down March 9 2026
		// OpenAI
		ModelChatGPT41,
		ModelChatGPT41Mini,
		ModelChatGPT53,
		ModelChatGPT5Mini,
		// ModelChatGPT4o, // redundant: superseded by gpt-4.1 (cheaper + newer)
		// ModelChatGPTo1, // reasoning model: needs multi-credit support for large outputs before enabling
	}
}
