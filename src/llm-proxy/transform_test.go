package llm_proxy

import (
	"encoding/json"
	"testing"
	"time"
)

// ---- helpers ----------------------------------------------------------------

func mustMarshal(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}

func chatReqT(t *testing.T, model string, messages []map[string]any) []byte {
	t.Helper()
	return mustMarshal(t, map[string]any{
		"model":    model,
		"messages": messages,
	})
}

// ---- convertToGeminiNative --------------------------------------------------

func TestGeminiNative_SimpleTextMessage(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": "Hello"},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	if err := json.Unmarshal(out, &req); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(req.Contents) != 1 {
		t.Fatalf("want 1 content, got %d", len(req.Contents))
	}
	if req.Contents[0].Role != "user" {
		t.Errorf("want role=user, got %q", req.Contents[0].Role)
	}
	if len(req.Contents[0].Parts) != 1 || req.Contents[0].Parts[0].Text != "Hello" {
		t.Errorf("unexpected parts: %+v", req.Contents[0].Parts)
	}
	if req.SystemInstruction != nil {
		t.Error("want no systemInstruction")
	}
}

func TestGeminiNative_AssistantRoleRemapped(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": "Hi"},
		{"role": "assistant", "content": "Hello!"},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	if len(req.Contents) != 2 {
		t.Fatalf("want 2 contents, got %d", len(req.Contents))
	}
	if req.Contents[1].Role != "model" {
		t.Errorf("want role=model for assistant, got %q", req.Contents[1].Role)
	}
}

func TestGeminiNative_SystemMessageExtracted(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "system", "content": "You are a helpful assistant."},
		{"role": "user", "content": "Hi"},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	// System message must NOT appear in contents
	if len(req.Contents) != 1 {
		t.Errorf("want 1 content (no system), got %d", len(req.Contents))
	}
	if req.SystemInstruction == nil {
		t.Fatal("want systemInstruction, got nil")
	}
	if len(req.SystemInstruction.Parts) != 1 || req.SystemInstruction.Parts[0].Text != "You are a helpful assistant." {
		t.Errorf("unexpected systemInstruction parts: %+v", req.SystemInstruction.Parts)
	}
}

func TestGeminiNative_MultipleSystemMessages(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "system", "content": "Part one."},
		{"role": "system", "content": "Part two."},
		{"role": "user", "content": "Go"},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	if req.SystemInstruction == nil {
		t.Fatal("want systemInstruction")
	}
	if len(req.SystemInstruction.Parts) != 2 {
		t.Errorf("want 2 system parts, got %d", len(req.SystemInstruction.Parts))
	}
}

func TestGeminiNative_ArrayContentParts(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": []any{
			map[string]any{"type": "text", "text": "What's in this image?"},
			map[string]any{"type": "image_url", "image_url": map[string]any{
				"url": "data:image/png;base64,abc123",
			}},
		}},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	parts := req.Contents[0].Parts
	if len(parts) != 2 {
		t.Fatalf("want 2 parts, got %d", len(parts))
	}
	if parts[0].Text != "What's in this image?" {
		t.Errorf("want text part, got %+v", parts[0])
	}
	if parts[1].InlineData == nil {
		t.Fatal("want inlineData for data URI")
	}
	if parts[1].InlineData.MIMEType != "image/png" {
		t.Errorf("want image/png, got %q", parts[1].InlineData.MIMEType)
	}
	if parts[1].InlineData.Data != "abc123" {
		t.Errorf("want abc123, got %q", parts[1].InlineData.Data)
	}
}

func TestGeminiNative_HTTPImageURL(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": []any{
			map[string]any{"type": "image_url", "image_url": map[string]any{
				"url": "https://example.com/photo.jpg",
			}},
		}},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	part := req.Contents[0].Parts[0]
	if part.FileData == nil {
		t.Fatal("want fileData for HTTP URL")
	}
	if part.FileData.FileURI != "https://example.com/photo.jpg" {
		t.Errorf("unexpected fileURI: %q", part.FileData.FileURI)
	}
	if part.FileData.MIMEType != "image/jpeg" {
		t.Errorf("want image/jpeg, got %q", part.FileData.MIMEType)
	}
}

func TestGeminiNative_PNGMimeType(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": []any{
			map[string]any{"type": "image_url", "image_url": map[string]any{
				"url": "https://example.com/image.PNG?v=1",
			}},
		}},
	})

	out, _ := convertToGeminiNative(body)
	var req geminiNativeReq
	json.Unmarshal(out, &req)

	if req.Contents[0].Parts[0].FileData.MIMEType != "image/png" {
		t.Errorf("want image/png for .PNG URL")
	}
}

func TestGeminiNative_ToolsInjected(t *testing.T) {
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": "Search the web"},
	})

	out, err := convertToGeminiNative(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	if len(req.Tools) != 2 {
		t.Fatalf("want 2 tools, got %d", len(req.Tools))
	}

	toolKeys := map[string]bool{}
	for _, tool := range req.Tools {
		for k := range tool {
			toolKeys[k] = true
		}
	}
	if !toolKeys["google_search"] {
		t.Error("want google_search tool")
	}
	if !toolKeys["code_execution"] {
		t.Error("want code_execution tool")
	}
}

func TestGeminiNative_NoToolsUseInvalidCamelCase(t *testing.T) {
	// Guard: ensure the invalid camelCase names are NOT present
	body := chatReqT(t, "gemini-2.5-flash", []map[string]any{
		{"role": "user", "content": "hi"},
	})
	out, _ := convertToGeminiNative(body)

	var req geminiNativeReq
	json.Unmarshal(out, &req)

	for _, tool := range req.Tools {
		if _, ok := tool["googleSearch"]; ok {
			t.Error("found invalid camelCase googleSearch — must be google_search")
		}
		if _, ok := tool["codeExecution"]; ok {
			t.Error("found invalid camelCase codeExecution — must be code_execution")
		}
	}
}

// ---- convertFromGeminiNative ------------------------------------------------

func makeGeminiResp(parts []geminiPart, finishReason string, promptTokens, candidateTokens, totalTokens int) []byte {
	resp := geminiNativeResp{
		Candidates: []geminiCandidate{
			{
				Content:      geminiContent{Role: "model", Parts: parts},
				FinishReason: finishReason,
			},
		},
	}
	resp.UsageMetadata.PromptTokenCount = promptTokens
	resp.UsageMetadata.CandidatesTokenCount = candidateTokens
	resp.UsageMetadata.TotalTokenCount = totalTokens
	b, _ := json.Marshal(resp)
	return b
}

func TestGeminiFromNative_SimpleText(t *testing.T) {
	raw := makeGeminiResp([]geminiPart{{Text: "Hello there!"}}, "STOP", 10, 5, 15)

	out, err := convertFromGeminiNative(raw, "gemini-2.5-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Object != "chat.completion" {
		t.Errorf("want chat.completion, got %q", resp.Object)
	}
	if len(resp.Choices) != 1 {
		t.Fatalf("want 1 choice, got %d", len(resp.Choices))
	}
	if resp.Choices[0].Message.Content != "Hello there!" {
		t.Errorf("unexpected content: %q", resp.Choices[0].Message.Content)
	}
	if resp.Choices[0].Message.Role != "assistant" {
		t.Errorf("want role=assistant, got %q", resp.Choices[0].Message.Role)
	}
	if resp.Choices[0].FinishReason != "stop" {
		t.Errorf("want finish_reason=stop, got %q", resp.Choices[0].FinishReason)
	}
	if resp.Usage.PromptTokens != 10 || resp.Usage.CompletionTokens != 5 || resp.Usage.TotalTokens != 15 {
		t.Errorf("unexpected usage: %+v", resp.Usage)
	}
}

func TestGeminiFromNative_MultipleTextParts(t *testing.T) {
	raw := makeGeminiResp([]geminiPart{
		{Text: "Part one. "},
		{Text: "Part two."},
	}, "STOP", 5, 10, 15)

	out, _ := convertFromGeminiNative(raw, "gemini-2.5-flash")
	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Choices[0].Message.Content != "Part one. Part two." {
		t.Errorf("unexpected content: %q", resp.Choices[0].Message.Content)
	}
}

func TestGeminiFromNative_CodeExecutionOutputCaptured(t *testing.T) {
	// Model returned no text summary, only a code execution result
	raw := makeGeminiResp([]geminiPart{
		{CodeExecutionResult: &geminiCodeExecResult{Outcome: "OUTCOME_OK", Output: "42\n"}},
	}, "STOP", 5, 8, 13)

	out, err := convertFromGeminiNative(raw, "gemini-2.5-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Choices[0].Message.Content != "42\n" {
		t.Errorf("want code output captured, got %q", resp.Choices[0].Message.Content)
	}
}

func TestGeminiFromNative_TextAndCodeExecutionCombined(t *testing.T) {
	raw := makeGeminiResp([]geminiPart{
		{Text: "The result is: "},
		{CodeExecutionResult: &geminiCodeExecResult{Outcome: "OUTCOME_OK", Output: "42"}},
	}, "STOP", 5, 8, 13)

	out, _ := convertFromGeminiNative(raw, "gemini-2.5-flash")
	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Choices[0].Message.Content != "The result is: 42" {
		t.Errorf("unexpected content: %q", resp.Choices[0].Message.Content)
	}
}

func TestGeminiFromNative_EmptyFinishReasonDefaultsToStop(t *testing.T) {
	raw := makeGeminiResp([]geminiPart{{Text: "hi"}}, "", 1, 1, 2)

	out, _ := convertFromGeminiNative(raw, "gemini-2.5-flash")
	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Choices[0].FinishReason != "stop" {
		t.Errorf("want stop, got %q", resp.Choices[0].FinishReason)
	}
}

func TestGeminiFromNative_ModelVersionFromResponse(t *testing.T) {
	resp := geminiNativeResp{
		ModelVersion: "gemini-2.5-flash-001",
		Candidates: []geminiCandidate{
			{Content: geminiContent{Parts: []geminiPart{{Text: "hi"}}}, FinishReason: "STOP"},
		},
	}
	b, _ := json.Marshal(resp)

	out, _ := convertFromGeminiNative(b, "gemini-2.5-flash")
	var chatResp chatCompletionsResp
	json.Unmarshal(out, &chatResp)

	if chatResp.Model != "gemini-2.5-flash-001" {
		t.Errorf("want modelVersion from response, got %q", chatResp.Model)
	}
}

func TestGeminiFromNative_ModelVersionFallsBackToArg(t *testing.T) {
	raw := makeGeminiResp([]geminiPart{{Text: "hi"}}, "STOP", 1, 1, 2)
	// makeGeminiResp leaves ModelVersion empty

	out, _ := convertFromGeminiNative(raw, "gemini-2.5-flash")
	var chatResp chatCompletionsResp
	json.Unmarshal(out, &chatResp)

	if chatResp.Model != "gemini-2.5-flash" {
		t.Errorf("want fallback to arg, got %q", chatResp.Model)
	}
}

func TestGeminiFromNative_APIError(t *testing.T) {
	resp := map[string]any{
		"error": map[string]any{
			"code":    400,
			"message": "Invalid request",
			"status":  "INVALID_ARGUMENT",
		},
	}
	b, _ := json.Marshal(resp)

	_, err := convertFromGeminiNative(b, "gemini-2.5-flash")
	if err == nil {
		t.Fatal("want error for API error response, got nil")
	}
}

func TestGeminiFromNative_NoCandidates(t *testing.T) {
	resp := geminiNativeResp{Candidates: nil}
	b, _ := json.Marshal(resp)

	_, err := convertFromGeminiNative(b, "gemini-2.5-flash")
	if err == nil {
		t.Fatal("want error for empty candidates, got nil")
	}
}

func TestGeminiFromNative_BlockedPrompt(t *testing.T) {
	resp := map[string]any{
		"promptFeedback": map[string]any{"blockReason": "SAFETY"},
	}
	b, _ := json.Marshal(resp)

	_, err := convertFromGeminiNative(b, "gemini-2.5-flash")
	if err == nil {
		t.Fatal("want error for blocked prompt, got nil")
	}
}

func TestGeminiFromNative_CreatedTimestampIsRecent(t *testing.T) {
	raw := makeGeminiResp([]geminiPart{{Text: "hi"}}, "STOP", 1, 1, 2)
	before := time.Now().Unix()
	out, _ := convertFromGeminiNative(raw, "gemini-2.5-flash")
	after := time.Now().Unix()

	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Created < before || resp.Created > after {
		t.Errorf("Created timestamp %d out of range [%d, %d]", resp.Created, before, after)
	}
}

// ---- convertToResponsesAPI --------------------------------------------------

func TestResponsesAPI_SimpleTextMessage(t *testing.T) {
	body := chatReqT(t, "gpt-4.1", []map[string]any{
		{"role": "user", "content": "Hello"},
	})

	out, err := convertToResponsesAPI(body)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var req responsesAPIReq
	json.Unmarshal(out, &req)

	if req.Model != "gpt-4.1" {
		t.Errorf("want model=gpt-4.1, got %q", req.Model)
	}
	if len(req.Input) != 1 {
		t.Fatalf("want 1 input item, got %d", len(req.Input))
	}
	// String content — no remapping, passed through as-is
	if req.Input[0]["content"] != "Hello" {
		t.Errorf("unexpected content: %v", req.Input[0]["content"])
	}
}

func TestResponsesAPI_ToolsInjected(t *testing.T) {
	body := chatReqT(t, "gpt-4.1", []map[string]any{
		{"role": "user", "content": "Search the web"},
	})

	out, _ := convertToResponsesAPI(body)
	var req responsesAPIReq
	json.Unmarshal(out, &req)

	if len(req.Tools) != 2 {
		t.Fatalf("want 2 tools, got %d", len(req.Tools))
	}

	types := map[string]bool{}
	for _, tool := range req.Tools {
		if typ, ok := tool["type"].(string); ok {
			types[typ] = true
		}
	}
	if !types["web_search_preview"] {
		t.Error("want web_search_preview tool")
	}
	if !types["code_interpreter"] {
		t.Error("want code_interpreter tool")
	}
}

func TestResponsesAPI_TextPartRemappedForUser(t *testing.T) {
	body := chatReqT(t, "gpt-4.1", []map[string]any{
		{"role": "user", "content": []any{
			map[string]any{"type": "text", "text": "Hello"},
		}},
	})

	out, _ := convertToResponsesAPI(body)
	var req responsesAPIReq
	json.Unmarshal(out, &req)

	content := req.Input[0]["content"].([]any)
	part := content[0].(map[string]any)
	if part["type"] != "input_text" {
		t.Errorf("want input_text for user text part, got %q", part["type"])
	}
}

func TestResponsesAPI_TextPartRemappedForAssistant(t *testing.T) {
	body := chatReqT(t, "gpt-4.1", []map[string]any{
		{"role": "assistant", "content": []any{
			map[string]any{"type": "text", "text": "Hi!"},
		}},
	})

	out, _ := convertToResponsesAPI(body)
	var req responsesAPIReq
	json.Unmarshal(out, &req)

	content := req.Input[0]["content"].([]any)
	part := content[0].(map[string]any)
	if part["type"] != "output_text" {
		t.Errorf("want output_text for assistant text part, got %q", part["type"])
	}
}

func TestResponsesAPI_ImageURLRemapped(t *testing.T) {
	body := chatReqT(t, "gpt-4.1", []map[string]any{
		{"role": "user", "content": []any{
			map[string]any{
				"type":      "image_url",
				"image_url": map[string]any{"url": "https://example.com/img.jpg"},
			},
		}},
	})

	out, _ := convertToResponsesAPI(body)
	var req responsesAPIReq
	json.Unmarshal(out, &req)

	content := req.Input[0]["content"].([]any)
	part := content[0].(map[string]any)
	if part["type"] != "input_image" {
		t.Errorf("want input_image, got %q", part["type"])
	}
	if part["image_url"] != "https://example.com/img.jpg" {
		t.Errorf("want flat image_url string, got %v", part["image_url"])
	}
}

// ---- convertFromResponsesAPI ------------------------------------------------

func makeResponsesResp(id, model, text string, inputTokens, outputTokens, totalTokens int) []byte {
	resp := responsesAPIResp{
		ID:     id,
		Object: "response",
		Model:  model,
		Output: []responsesOutputItem{
			{
				Type: "message",
				Role: "assistant",
				Content: []responsesContentPart{
					{Type: "output_text", Text: text},
				},
			},
		},
	}
	resp.Usage.InputTokens = inputTokens
	resp.Usage.OutputTokens = outputTokens
	resp.Usage.TotalTokens = totalTokens
	b, _ := json.Marshal(resp)
	return b
}

func TestResponsesFromAPI_SimpleText(t *testing.T) {
	raw := makeResponsesResp("resp_abc", "gpt-4.1", "Hello!", 10, 5, 15)

	out, err := convertFromResponsesAPI(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.ID != "chatcmpl-resp_abc" {
		t.Errorf("want chatcmpl-resp_abc, got %q", resp.ID)
	}
	if resp.Model != "gpt-4.1" {
		t.Errorf("want gpt-4.1, got %q", resp.Model)
	}
	if len(resp.Choices) != 1 {
		t.Fatalf("want 1 choice, got %d", len(resp.Choices))
	}
	if resp.Choices[0].Message.Content != "Hello!" {
		t.Errorf("unexpected content: %q", resp.Choices[0].Message.Content)
	}
	if resp.Choices[0].Message.Role != "assistant" {
		t.Errorf("want role=assistant, got %q", resp.Choices[0].Message.Role)
	}
	if resp.Choices[0].FinishReason != "stop" {
		t.Errorf("want stop, got %q", resp.Choices[0].FinishReason)
	}
	if resp.Usage.PromptTokens != 10 || resp.Usage.CompletionTokens != 5 || resp.Usage.TotalTokens != 15 {
		t.Errorf("unexpected usage: %+v", resp.Usage)
	}
}

func TestResponsesFromAPI_MultipleOutputTextPartsConcatenated(t *testing.T) {
	resp := responsesAPIResp{
		ID:    "x",
		Model: "gpt-4.1",
		Output: []responsesOutputItem{
			{
				Type: "message",
				Role: "assistant",
				Content: []responsesContentPart{
					{Type: "output_text", Text: "Part A. "},
					{Type: "output_text", Text: "Part B."},
				},
			},
		},
	}
	b, _ := json.Marshal(resp)

	out, _ := convertFromResponsesAPI(b)
	var chatResp chatCompletionsResp
	json.Unmarshal(out, &chatResp)

	if chatResp.Choices[0].Message.Content != "Part A. Part B." {
		t.Errorf("unexpected content: %q", chatResp.Choices[0].Message.Content)
	}
}

func TestResponsesFromAPI_NonMessageOutputItemsSkipped(t *testing.T) {
	// Tool calls and other non-message output items should be skipped
	resp := responsesAPIResp{
		ID:    "x",
		Model: "gpt-4.1",
		Output: []responsesOutputItem{
			{Type: "tool_call", Role: ""},
			{Type: "message", Role: "assistant", Content: []responsesContentPart{
				{Type: "output_text", Text: "Done."},
			}},
		},
	}
	b, _ := json.Marshal(resp)

	out, _ := convertFromResponsesAPI(b)
	var chatResp chatCompletionsResp
	json.Unmarshal(out, &chatResp)

	if chatResp.Choices[0].Message.Content != "Done." {
		t.Errorf("unexpected content: %q", chatResp.Choices[0].Message.Content)
	}
}

func TestResponsesFromAPI_APIError(t *testing.T) {
	resp := responsesAPIResp{
		Error: &struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}{Code: "invalid_request", Message: "bad input"},
	}
	b, _ := json.Marshal(resp)

	_, err := convertFromResponsesAPI(b)
	if err == nil {
		t.Fatal("want error for API error response, got nil")
	}
}

func TestResponsesFromAPI_NoOutput(t *testing.T) {
	resp := responsesAPIResp{ID: "x", Model: "gpt-4.1", Output: nil}
	b, _ := json.Marshal(resp)

	_, err := convertFromResponsesAPI(b)
	if err == nil {
		t.Fatal("want error for empty output, got nil")
	}
}

func TestResponsesFromAPI_CreatedTimestampIsRecent(t *testing.T) {
	raw := makeResponsesResp("id", "gpt-4.1", "hi", 1, 1, 2)
	before := time.Now().Unix()
	out, _ := convertFromResponsesAPI(raw)
	after := time.Now().Unix()

	var resp chatCompletionsResp
	json.Unmarshal(out, &resp)

	if resp.Created < before || resp.Created > after {
		t.Errorf("Created timestamp %d out of range [%d, %d]", resp.Created, before, after)
	}
}

// ---- imageURLToGeminiPart ---------------------------------------------------

func TestImageURLToGeminiPart_DataURI(t *testing.T) {
	part, ok := imageURLToGeminiPart("data:image/webp;base64,AAAA")
	if !ok {
		t.Fatal("want ok=true")
	}
	if part.InlineData == nil {
		t.Fatal("want inlineData")
	}
	if part.InlineData.MIMEType != "image/webp" {
		t.Errorf("want image/webp, got %q", part.InlineData.MIMEType)
	}
	if part.InlineData.Data != "AAAA" {
		t.Errorf("want AAAA, got %q", part.InlineData.Data)
	}
}

func TestImageURLToGeminiPart_DataURINonBase64Rejected(t *testing.T) {
	_, ok := imageURLToGeminiPart("data:image/png;utf8,hello")
	if ok {
		t.Error("want ok=false for non-base64 data URI")
	}
}

func TestImageURLToGeminiPart_DataURIMissingCommaRejected(t *testing.T) {
	_, ok := imageURLToGeminiPart("data:image/png;base64")
	if ok {
		t.Error("want ok=false for malformed data URI")
	}
}

func TestImageURLToGeminiPart_HTTPSURLUsesFileData(t *testing.T) {
	part, ok := imageURLToGeminiPart("https://cdn.example.com/img.gif")
	if !ok {
		t.Fatal("want ok=true")
	}
	if part.FileData == nil {
		t.Fatal("want fileData")
	}
	if part.FileData.MIMEType != "image/gif" {
		t.Errorf("want image/gif, got %q", part.FileData.MIMEType)
	}
	if part.FileData.FileURI != "https://cdn.example.com/img.gif" {
		t.Errorf("unexpected fileURI: %q", part.FileData.FileURI)
	}
}
