package utils

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
)

// UploadToSupabaseStorage uploads a file's bytes to a Supabase Storage
// bucket via Supabase's REST API and returns the public URL.
//
// This talks to Supabase Storage directly over HTTP instead of pulling in
// the full Supabase Go SDK — it's one endpoint, so a raw request keeps the
// dependency list untouched.
//
// Required env vars:
//   - SUPABASE_URL               e.g. https://xxxxx.supabase.co
//   - SUPABASE_SERVICE_ROLE_KEY  the service_role key (Project Settings > API)
//   - SUPABASE_STORAGE_BUCKET    the bucket name, e.g. "avatars" (must exist
//     and be set to Public in the Supabase dashboard)
func UploadToSupabaseStorage(objectPath string, contentType string, data []byte) (string, error) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	bucket := os.Getenv("SUPABASE_STORAGE_BUCKET")

	if supabaseURL == "" || serviceKey == "" || bucket == "" {
		return "", fmt.Errorf("profile picture uploads aren't configured on the server (missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_STORAGE_BUCKET)")
	}

	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, objectPath)

	req, err := http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("building upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Content-Type", contentType)
	// Overwrite if an object already exists at this path (relevant when a
	// user replaces their photo using a path derived from their user id).
	req.Header.Set("x-upsert", "true")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("uploading to storage: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("storage upload failed (%d): %s", resp.StatusCode, string(body))
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, objectPath)
	return publicURL, nil
}
