package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

const geminiAPIURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"

type geminiPart struct {
	Text string `json:"text"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiGenConfig struct {
	ResponseMimeType string `json:"responseMimeType,omitempty"`
}

type geminiRequest struct {
	Contents          []geminiContent  `json:"contents"`
	SystemInstruction *geminiContent   `json:"systemInstruction,omitempty"`
	GenerationConfig  *geminiGenConfig `json:"generationConfig,omitempty"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}

type geminiResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
	Error      *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// CallGemini sends a single-turn prompt (system instructions + one user
// message) to the Google Gemini API and returns the model's plain text
// reply.
//
// Requires GEMINI_API_KEY to be set in the environment. Every AI feature in
// this codebase goes through this function or CallGeminiJSON below — there
// is no other place that talks to an LLM — which makes it easy to audit
// exactly what gets sent externally: only whatever string is passed in as
// userMessage.
func CallGemini(systemPrompt, userMessage string) (string, error) {
	return callGemini(systemPrompt, userMessage, false)
}

// CallGeminiJSON is the same as CallGemini, but tells Gemini to constrain
// its output to valid JSON (via generationConfig.responseMimeType) instead
// of relying on the model to follow a "respond only with JSON" instruction
// in plain text — used by the chat assistant, which needs to reliably
// parse a structured {reply, action} shape rather than free-form prose.
func CallGeminiJSON(systemPrompt, userMessage string) (string, error) {
	return callGemini(systemPrompt, userMessage, true)
}

func callGemini(systemPrompt, userMessage string, jsonMode bool) (string, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return "", fmt.Errorf("GEMINI_API_KEY is not set")
	}

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: userMessage}}},
		},
		SystemInstruction: &geminiContent{
			Parts: []geminiPart{{Text: systemPrompt}},
		},
	}
	if jsonMode {
		reqBody.GenerationConfig = &geminiGenConfig{ResponseMimeType: "application/json"}
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to build request: %w", err)
	}

	req, err := http.NewRequest("POST", geminiAPIURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// Keep credentials out of request URLs, which are commonly captured in
	// access logs and tracing metadata.
	req.Header.Set("x-goog-api-key", apiKey)

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request to Gemini API failed: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read Gemini response: %w", err)
	}

	var parsed geminiResponse
	if err := json.Unmarshal(respBytes, &parsed); err != nil {
		return "", fmt.Errorf("failed to parse Gemini response: %w", err)
	}

	if parsed.Error != nil {
		return "", fmt.Errorf("gemini API error: %s", parsed.Error.Message)
	}
	if len(parsed.Candidates) == 0 || len(parsed.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini API")
	}

	return parsed.Candidates[0].Content.Parts[0].Text, nil
}
