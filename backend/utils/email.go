package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type resendEmailPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

// SendEmail sends a transactional email via Resend's HTTP API directly
// (no SDK dependency — same approach as UploadToSupabaseStorage). Requires
// RESEND_API_KEY.
//
// EMAIL_FROM controls the sender address. Until a custom domain is
// verified in Resend's dashboard, Resend's shared sandbox sender
// (onboarding@resend.dev, used here if EMAIL_FROM is unset) can only
// actually deliver to the email address on the Resend account itself —
// fine for testing, not for real users. See https://resend.com/domains.
func SendEmail(to, subject, html string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		return fmt.Errorf("email sending is not configured (RESEND_API_KEY is not set)")
	}
	from := os.Getenv("EMAIL_FROM")
	if from == "" {
		from = "Lekha <onboarding@resend.dev>"
	}

	payload := resendEmailPayload{From: from, To: []string{to}, Subject: subject, HTML: html}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("resend API error (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}
