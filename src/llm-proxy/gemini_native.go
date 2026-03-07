package llm_proxy

import (
	"encoding/json"
	"github.com/cockroachdb/errors"
	"llmmask/src/confs"
	"strings"
	"time"
)

func isGeminiModel(model confs.ModelName) bool {
	switch model {
	case confs.ModelGemini25Flash, confs.ModelGemini25Pro, confs.ModelGemini25FlashLite,
		confs.ModelGemini3Flash, confs.ModelGemini3Pro:
		return true
	}
	return false
}

// geminiNativeReq is the Gemini generateContent request format.
type geminiNativeReq struct {
	Contents          []geminiContent  `json:"contents"`
	SystemInstruction *geminiContent   `json:"systemInstruction,omitempty"`
	Tools             []map[string]any `json:"tools,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text                string                `json:"text,omitempty"`
	InlineData          *geminiInlineData     `json:"inlineData,omitempty"`
	FileData            *geminiFileData       `json:"fileData,omitempty"`
	ExecutableCode      *geminiExecutableCode `json:"executableCode,omitempty"`
	CodeExecutionResult *geminiCodeExecResult `json:"codeExecutionResult,omitempty"`
}

type geminiExecutableCode struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

type geminiCodeExecResult struct {
	Outcome string `json:"outcome"`
	Output  string `json:"output"`
}

type geminiInlineData struct {
	MIMEType string `json:"mimeType"`
	Data     string `json:"data"` // base64-encoded
}

type geminiFileData struct {
	MIMEType string `json:"mimeType"`
	FileURI  string `json:"fileUri"`
}

// geminiNativeResp is the Gemini generateContent response format.
type geminiNativeResp struct {
	Candidates    []geminiCandidate `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int `json:"promptTokenCount"`
		CandidatesTokenCount int `json:"candidatesTokenCount"`
		TotalTokenCount      int `json:"totalTokenCount"`
	} `json:"usageMetadata"`
	ModelVersion   string `json:"modelVersion"`
	PromptFeedback *struct {
		BlockReason string `json:"blockReason"`
	} `json:"promptFeedback,omitempty"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

type geminiCandidate struct {
	Content      geminiContent `json:"content"`
	FinishReason string        `json:"finishReason"`
}

var geminiNativeTools = []map[string]any{
	{"google_search": map[string]any{}},
	{"code_execution": map[string]any{}},
}

// convertToGeminiNative converts a Chat Completions request body to the Gemini generateContent format,
// injecting google_search and code_execution tools.
func convertToGeminiNative(body []byte) ([]byte, error) {
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, err
	}

	messages, _ := raw["messages"].([]any)

	var systemParts []geminiPart
	var contents []geminiContent

	for _, m := range messages {
		msg, ok := m.(map[string]any)
		if !ok {
			continue
		}
		role, _ := msg["role"].(string)
		parts := chatContentToGeminiParts(msg["content"])

		if role == "system" {
			systemParts = append(systemParts, parts...)
			continue
		}

		geminiRole := role
		if role == "assistant" {
			geminiRole = "model"
		}
		contents = append(contents, geminiContent{
			Role:  geminiRole,
			Parts: parts,
		})
	}

	req := geminiNativeReq{
		Contents: contents,
		Tools:    geminiNativeTools,
	}
	if len(systemParts) > 0 {
		req.SystemInstruction = &geminiContent{Parts: systemParts}
	}
	return json.Marshal(req)
}

// chatContentToGeminiParts converts a Chat Completions message content (string or array) to Gemini parts.
func chatContentToGeminiParts(content any) []geminiPart {
	switch v := content.(type) {
	case string:
		return []geminiPart{{Text: v}}
	case []any:
		var parts []geminiPart
		for _, item := range v {
			partMap, ok := item.(map[string]any)
			if !ok {
				continue
			}
			typ, _ := partMap["type"].(string)
			switch typ {
			case "text":
				text, _ := partMap["text"].(string)
				parts = append(parts, geminiPart{Text: text})
			case "image_url":
				imgObj, ok := partMap["image_url"].(map[string]any)
				if !ok {
					continue
				}
				urlStr, _ := imgObj["url"].(string)
				if part, ok := imageURLToGeminiPart(urlStr); ok {
					parts = append(parts, part)
				}
			}
		}
		return parts
	}
	return nil
}

// imageURLToGeminiPart converts an image URL to a Gemini part.
// Handles data URIs (inlineData) and HTTP/HTTPS URLs (fileData).
func imageURLToGeminiPart(urlStr string) (geminiPart, bool) {
	if withoutScheme, ok := strings.CutPrefix(urlStr, "data:"); ok {
		// data:<mimeType>;base64,<data>
		semicolonIdx := strings.Index(withoutScheme, ";")
		if semicolonIdx < 0 {
			return geminiPart{}, false
		}
		mimeType := withoutScheme[:semicolonIdx]
		rest := withoutScheme[semicolonIdx+1:]
		commaIdx := strings.Index(rest, ",")
		if commaIdx < 0 {
			return geminiPart{}, false
		}
		encoding := rest[:commaIdx]
		if encoding != "base64" {
			return geminiPart{}, false
		}
		data := rest[commaIdx+1:]
		return geminiPart{
			InlineData: &geminiInlineData{
				MIMEType: mimeType,
				Data:     data,
			},
		}, true
	}

	// HTTP/HTTPS URL — use fileData (Gemini 2.0+ can fetch public URLs directly).
	return geminiPart{
		FileData: &geminiFileData{
			MIMEType: mimeTypeFromImageURL(urlStr),
			FileURI:  urlStr,
		},
	}, true
}

func mimeTypeFromImageURL(urlStr string) string {
	lower := strings.ToLower(urlStr)
	switch {
	case strings.Contains(lower, ".png"):
		return "image/png"
	case strings.Contains(lower, ".gif"):
		return "image/gif"
	case strings.Contains(lower, ".webp"):
		return "image/webp"
	default:
		return "image/jpeg"
	}
}

// convertFromGeminiNative converts a Gemini generateContent response back to Chat Completions format.
func convertFromGeminiNative(body []byte, model string) ([]byte, error) {
	var resp geminiNativeResp
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, errors.Newf("gemini API error %d %s: %s", resp.Error.Code, resp.Error.Status, resp.Error.Message)
	}
	if resp.PromptFeedback != nil && resp.PromptFeedback.BlockReason != "" {
		return nil, errors.Newf("gemini API blocked prompt: %s", resp.PromptFeedback.BlockReason)
	}
	if len(resp.Candidates) == 0 {
		return nil, errors.New("gemini API returned no candidates")
	}

	cand := resp.Candidates[0]
	var sb strings.Builder
	for _, part := range cand.Content.Parts {
		if part.Text != "" {
			sb.WriteString(part.Text)
		}
		// Include code execution output when the model doesn't emit a summary text part.
		if part.CodeExecutionResult != nil && part.CodeExecutionResult.Output != "" {
			sb.WriteString(part.CodeExecutionResult.Output)
		}
	}

	finishReason := strings.ToLower(cand.FinishReason)
	if finishReason == "" {
		finishReason = "stop"
	}

	modelVersion := resp.ModelVersion
	if modelVersion == "" {
		modelVersion = model
	}

	chatResp := chatCompletionsResp{
		ID:      "chatcmpl-gemini",
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   modelVersion,
		Choices: []chatCompletionsChoice{
			{
				Index: 0,
				Message: chatCompletionsMessage{
					Role:    "assistant",
					Content: sb.String(),
				},
				FinishReason: finishReason,
			},
		},
		Usage: chatCompletionsUsage{
			PromptTokens:     resp.UsageMetadata.PromptTokenCount,
			CompletionTokens: resp.UsageMetadata.CandidatesTokenCount,
			TotalTokens:      resp.UsageMetadata.TotalTokenCount,
		},
	}
	return json.Marshal(chatResp)
}
