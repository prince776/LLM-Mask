package llm_proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/cockroachdb/errors"
	"llmmask/src/log"
	"net/http"
)

// ContentModerator is a client wrapper for the Azure AI Content Safety API.
type ContentModerator struct {
	endpoint string
	apiKey   string
	client   *http.Client
}

// ContentModerationRequest represents the JSON request body for the text analysis API.
type ContentModerationRequest struct {
	Text string `json:"text"`
}

// ContentSafetyResponse represents the top-level JSON response from the text analysis API.
type ContentSafetyResponse struct {
	CategoriesAnalysis []CategoryAnalysis `json:"categoriesAnalysis"`
	BlocklistsMatch    []BlocklistMatch   `json:"blocklistsMatch"`
}

// CategoryAnalysis contains the moderation result for a specific harm category.
type CategoryAnalysis struct {
	Category string `json:"category"`
	Severity int    `json:"severity"`
}

// BlocklistMatch contains details if a custom blocklist was matched.
type BlocklistMatch struct {
	BlocklistName string `json:"blocklistName"`
	MatchingText  string `json:"matchingText"`
}

// NewContentModerator creates a new instance of ContentModerator.
func NewContentModerator(endpoint, apiKey string) *ContentModerator {
	return &ContentModerator{
		endpoint: endpoint,
		apiKey:   apiKey,
		client:   http.DefaultClient,
	}
}

// AnalyzeText sends text to the Azure AI Content Safety API for moderation.
func (cm *ContentModerator) AnalyzeText(ctx context.Context, text string) (*ContentSafetyResponse, error) {
	log.Infof(ctx, "Checking for moderation")
	requestBody := ContentModerationRequest{Text: text}
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to marshal request")
	}

	url := fmt.Sprintf("%s/contentsafety/text:analyze?api-version=2024-09-01", cm.endpoint)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, errors.Wrapf(err, "failed to create request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Ocp-Apim-Subscription-Key", cm.apiKey)

	resp, err := cm.client.Do(req)
	if err != nil {
		return nil, errors.Wrapf(err, "API request failed")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errResp map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&errResp)
		if err != nil {
			return nil, errors.Wrapf(err, "failed to unmarshal response")
		}
		return nil, errors.Newf("API call failed with status %s: %+v", resp.Status, errResp)
	}

	var contentSafetyResp ContentSafetyResponse
	if err := json.NewDecoder(resp.Body).Decode(&contentSafetyResp); err != nil {
		return nil, errors.Wrapf(err, "failed to decode response")
	}

	return &contentSafetyResp, nil
}
