package utils

import (
	"database/sql"
	"testing"
)

func TestIsValidUUID(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"5430c3b3-f42b-4eb3-bc73-ae129aa5864f", true},
		{"", false},
		{"not-a-uuid", false},
		// google/uuid's Parse() intentionally accepts this compact form too
		// (32 hex chars, no dashes) as an alternate valid representation —
		// not a bug, just a more lenient parser than the dashed format alone.
		{"5430c3b3f42b4eb3bc73ae129aa5864f", true},
		{"5430c3b3-f42b-4eb3-bc73", false}, // truncated — genuinely malformed
	}
	for _, c := range cases {
		if got := IsValidUUID(c.in); got != c.want {
			t.Errorf("IsValidUUID(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestIsValidTransferStatus(t *testing.T) {
	valid := []string{"PENDING", "COMPLETED", "CANCELLED", "REVERSED"}
	for _, s := range valid {
		if !IsValidTransferStatus(s) {
			t.Errorf("IsValidTransferStatus(%q) = false, want true", s)
		}
	}

	invalid := []string{"", "PROCESSING", "FAILED", "pending", "completed"}
	for _, s := range invalid {
		if IsValidTransferStatus(s) {
			t.Errorf("IsValidTransferStatus(%q) = true, want false (PROCESSING/FAILED were removed, status is case-sensitive)", s)
		}
	}
}

func TestIsValidLang(t *testing.T) {
	if !IsValidLang("en") || !IsValidLang("hi") {
		t.Error("expected en and hi to both be valid languages")
	}
	for _, s := range []string{"", "EN", "fr", "english"} {
		if IsValidLang(s) {
			t.Errorf("IsValidLang(%q) = true, want false", s)
		}
	}
}

func TestNullStringToPtr(t *testing.T) {
	if got := NullStringToPtr(sql.NullString{Valid: false}); got != nil {
		t.Errorf("expected nil for an invalid NullString, got %v", *got)
	}

	got := NullStringToPtr(sql.NullString{String: "hello", Valid: true})
	if got == nil || *got != "hello" {
		t.Errorf("expected pointer to \"hello\", got %v", got)
	}
}

func TestNullStringOrEmpty(t *testing.T) {
	if got := NullStringOrEmpty(sql.NullString{Valid: false}); got != "" {
		t.Errorf("expected empty string for an invalid NullString, got %q", got)
	}
	if got := NullStringOrEmpty(sql.NullString{String: "hello", Valid: true}); got != "hello" {
		t.Errorf("expected %q, got %q", "hello", got)
	}
}

func TestHashSummary_SameInputSameHash(t *testing.T) {
	a := HashSummary([]byte(`{"total":100}`))
	b := HashSummary([]byte(`{"total":100}`))
	if a != b {
		t.Errorf("expected identical input to produce identical hash, got %q vs %q", a, b)
	}
}

func TestHashSummary_DifferentInputDifferentHash(t *testing.T) {
	a := HashSummary([]byte(`{"total":100}`))
	b := HashSummary([]byte(`{"total":101}`))
	if a == b {
		t.Error("expected different input to produce a different hash — this is what makes the insight cache correctness-based rather than time-based")
	}
}

func TestInsightCache_MissThenHitThenInvalidateOnChange(t *testing.T) {
	key := "test:company:unit-test-only"
	hash1 := HashSummary([]byte(`{"total":100}`))
	hash2 := HashSummary([]byte(`{"total":200}`))

	if _, ok := GetCachedInsight(key, hash1); ok {
		t.Fatal("expected a cache miss before anything was ever stored")
	}

	SetCachedInsight(key, hash1, "this company did well")
	got, ok := GetCachedInsight(key, hash1)
	if !ok || got != "this company did well" {
		t.Fatalf("expected a cache hit with the stored text, got ok=%v got=%q", ok, got)
	}

	// The underlying data "changed" (different hash) — must NOT return the
	// insight that was generated for the old numbers. This is the specific
	// bug class this whole cache design exists to prevent.
	if _, ok := GetCachedInsight(key, hash2); ok {
		t.Fatal("expected a cache miss for a different summary hash under the same key — serving stale text here would be a real correctness bug")
	}
}

func TestMsg_FallsBackToEnglishForUnknownKey(t *testing.T) {
	// Msg needs a *gin.Context in real use to resolve language, but with no
	// context set up at all, LangFromContext defaults to English — this
	// just confirms an unknown key returns the key itself (loud and
	// obviously wrong in dev) rather than an empty string (silently wrong).
	if got := Msg(nil, "this_key_does_not_exist"); got != "this_key_does_not_exist" {
		t.Errorf("expected unknown key to fall back to itself, got %q", got)
	}
}

func TestGenerateSecureToken(t *testing.T) {
	raw1, hash1, err := GenerateSecureToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if raw1 == "" || hash1 == "" {
		t.Fatal("expected non-empty raw token and hash")
	}
	if raw1 == hash1 {
		t.Error("the raw token and its hash should never be equal to each other")
	}
	if got := HashToken(raw1); got != hash1 {
		t.Errorf("HashToken(raw) = %q, want it to match the hash GenerateSecureToken returned (%q) — otherwise a token could never be looked up again by its hash", got, hash1)
	}

	raw2, hash2, err := GenerateSecureToken()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if raw1 == raw2 || hash1 == hash2 {
		t.Error("two calls produced the same token — the randomness source is broken")
	}
}
