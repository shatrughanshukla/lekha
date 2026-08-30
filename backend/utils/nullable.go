package utils

import "database/sql"

// NullStringToPtr converts a nullable SQL string column into a Go *string —
// nil when the column was NULL, a pointer to the value otherwise. Used for
// optional fields like users.profile_picture_url that most rows won't have
// set, so callers can tell "not set" apart from "set to empty string".
func NullStringToPtr(ns sql.NullString) *string {
	if !ns.Valid {
		return nil
	}
	return &ns.String
}

// NullStringOrEmpty converts a nullable SQL string column into a plain Go
// string — "" when the column was NULL. Used for display-only joined
// fields (like a proposer's name) where the caller only cares about the
// value, not distinguishing "not set" from "empty".
func NullStringOrEmpty(ns sql.NullString) string {
	if !ns.Valid {
		return ""
	}
	return ns.String
}
