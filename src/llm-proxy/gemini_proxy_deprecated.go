package llm_proxy

import (
	"context"
	"google.golang.org/genai"
	"llmmask/src/common"
)

// NOTE: Not really going with this approach, but will keep the code around for some testing for some time.

type GeminiProxy struct {
	client *genai.Client
	model  string
}

func NewGeminiProxy(ctx context.Context, apiKey common.SecretString, model string) (*GeminiProxy, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey.UnsafeString(),
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, err
	}

	return &GeminiProxy{
		client: client,
		model:  model,
	}, nil
}

func (g *GeminiProxy) CreateNewChat(ctx context.Context, history []*genai.Content) (*genai.Chat, error) {
	return g.client.Chats.Create(
		ctx,
		g.model,
		nil, // config
		history,
	)
}

func (g *GeminiProxy) SendMessage(ctx context.Context, message string, chat *genai.Chat) (string, error) {
	var err error
	if chat == nil {
		chat, err = g.CreateNewChat(ctx, []*genai.Content{})
		if err != nil {
			return "", err
		}
	}
	resp, err := chat.SendMessage(ctx, genai.Part{Text: message})
	if err != nil {
		return "", err
	}
	return resp.Text(), nil
}
