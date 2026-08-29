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
