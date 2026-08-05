package utils

import "github.com/google/uuid"

// IsValidUUID reports whether s is a syntactically valid UUID.
//
// Handlers call this on every path/query parameter that's supposed to be an
// ID, before it ever reaches a SQL query. Without this check, a malformed
// value (e.g. "not-a-real-uuid") sails past Go entirely, Postgres itself
// rejects it with "invalid input syntax for type uuid", and that raw
// database error used to leak back to the client as an unhelpful 500.
func IsValidUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

// validTransferStatuses mirrors transfer_status_enum in Postgres exactly.
var validTransferStatuses = map[string]bool{
	"PENDING":    true,
	"PROCESSING": true,
	"COMPLETED":  true,
	"FAILED":     true,
	"CANCELLED":  true,
	"REVERSED":   true,
}

// IsValidTransferStatus reports whether s is one of the real enum values.
// Used to validate the ?status= query filter before it reaches a query —
// otherwise an invalid value causes Postgres to reject the enum comparison
// and the request fails with a raw 500 instead of a clean 400.
func IsValidTransferStatus(s string) bool {
	return validTransferStatuses[s]
}
