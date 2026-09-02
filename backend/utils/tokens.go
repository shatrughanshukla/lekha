package utils

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
)

// GenerateSecureToken returns a cryptographically random 64-character hex
// token and its SHA-256 hash. The RAW token is what goes into the emailed
// link; only the HASH is ever written to the database (see auth_tokens in
// migration 004) — the same reason passwords are hashed rather than
// stored plainly, so a database leak alone can't be used to forge a
// working reset/verify link.
func GenerateSecureToken() (raw string, hash string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	raw = hex.EncodeToString(b)
	hash = HashToken(raw)
	return raw, hash, nil
}

// HashToken hashes a raw token the same way GenerateSecureToken does, so a
// token a client presents back can be looked up by its hash.
func HashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
}
