package llm_proxy

import (
	"encoding/json"
	"github.com/cockroachdb/errors"
	"llmmask/src/confs"
	"maps"
	"strings"
	"time"
)

func isOpenAIModel(model confs.ModelName) bool {
	switch model {
	case confs.ModelChatGPT41, confs.ModelChatGPT41Mini, confs.ModelChatGPT4o,
		confs.ModelChatGPTo1, confs.ModelChatGPT53, confs.ModelChatGPT5Mini:
		return true
	}
	return false
}

// responsesAPIReq is the OpenAI Responses API request format.
type responsesAPIReq struct {
	Model string                   `json:"model"`
	Input []map[string]any `json:"input"`
	Tools []map[string]any `json:"tools"`
}

// responsesAPIResp is the OpenAI Responses API response format.
type responsesAPIResp struct {
	ID     string                `json:"id"`
	Object string                `json:"object"`
	Model  string                `json:"model"`
	Output []responsesOutputItem `json:"output"`
	Usage  struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type responsesOutputItem struct {
	Type    string                 `json:"type"`
	Role    string                 `json:"role,omitempty"`
	Content []responsesContentPart `json:"content,omitempty"`
}

type responsesContentPart struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// chatCompletionsResp mirrors the OpenAI Chat Completions response format.
type chatCompletionsResp struct {
	ID      string                  `json:"id"`
	Object  string                  `json:"object"`
	Created int64                   `json:"created"`
	Model   string                  `json:"model"`
	Choices []chatCompletionsChoice `json:"choices"`
	Usage   chatCompletionsUsage    `json:"usage"`
}

type chatCompletionsChoice struct {
	Index        int                    `json:"index"`
	Message      chatCompletionsMessage `json:"message"`
	FinishReason string                 `json:"finish_reason"`
}

type chatCompletionsMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionsUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

var responsesAPITools = []map[string]any{
	{"type": "web_search_preview"},
	{
		"type":      "code_interpreter",
		"container": map[string]any{"type": "auto"},
	},
}

// convertToResponsesAPI converts a Chat Completions request body to the Responses API format,
// injecting web_search_preview and code_interpreter tools.
func convertToResponsesAPI(body []byte) ([]byte, error) {
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	messages, _ := raw["messages"].([]any)
	input := make([]map[string]any, 0, len(messages))
	for _, m := range messages {
		if msg, ok := m.(map[string]any); ok {
			input = append(input, remapContentTypes(msg))
		}
	}

	req := responsesAPIReq{
		Model: raw["model"].(string),
		Input: input,
		Tools: responsesAPITools,
	}
	return json.Marshal(req)
}

// remapContentTypes rewrites content part types from Chat Completions to Responses API format.
// "text" → "input_text" for user/system, "text" → "output_text" for assistant.
func remapContentTypes(msg map[string]any) map[string]any {
	contentArr, ok := msg["content"].([]any)
	if !ok {
		// String content — no remapping needed.
		return msg
	}

	role, _ := msg["role"].(string)
	newContent := make([]any, 0, len(contentArr))
	for _, part := range contentArr {
		partMap, ok := part.(map[string]any)
		if !ok {
			newContent = append(newContent, part)
			continue
		}
		switch t, _ := partMap["type"].(string); t {
		case "text":
			newPart := make(map[string]any, len(partMap))
			maps.Copy(newPart, partMap)
			if role == "assistant" {
				newPart["type"] = "output_text"
			} else {
				newPart["type"] = "input_text"
			}
			newContent = append(newContent, newPart)
		case "image_url":
			// Chat Completions: {"type":"image_url","image_url":{"url":"..."}}
			// Responses API:    {"type":"input_image","image_url":"..."}
			newPart := map[string]any{"type": "input_image"}
			if imgObj, ok := partMap["image_url"].(map[string]any); ok {
				newPart["image_url"] = imgObj["url"]
			}
			newContent = append(newContent, newPart)
		default:
			newContent = append(newContent, partMap)
		}
	}

	result := make(map[string]any, len(msg))
	maps.Copy(result, msg)
	result["content"] = newContent
	return result
}

// convertFromResponsesAPI converts a Responses API response body back to Chat Completions format.
func convertFromResponsesAPI(body []byte) ([]byte, error) {
	var resp responsesAPIResp
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, errors.Newf("responses API error %s: %s", resp.Error.Code, resp.Error.Message)
	}
	if len(resp.Output) == 0 {
		return nil, errors.New("responses API returned no output items")
	}

	// Collect all assistant text from output items.
	var sb strings.Builder
	for _, item := range resp.Output {
		if item.Type == "message" && item.Role == "assistant" {
			for _, part := range item.Content {
				if part.Type == "output_text" {
					sb.WriteString(part.Text)
				}
			}
		}
	}

	chatResp := chatCompletionsResp{
		ID:      "chatcmpl-" + resp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   resp.Model,
		Choices: []chatCompletionsChoice{
			{
				Index: 0,
				Message: chatCompletionsMessage{
					Role:    "assistant",
					Content: sb.String(),
				},
				FinishReason: "stop",
			},
		},
		Usage: chatCompletionsUsage{
			PromptTokens:     resp.Usage.InputTokens,
			CompletionTokens: resp.Usage.OutputTokens,
			TotalTokens:      resp.Usage.TotalTokens,
		},
	}
	return json.Marshal(chatResp)
}
