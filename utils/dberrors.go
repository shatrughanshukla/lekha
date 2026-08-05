package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

// RespondDBError inspects a database error and responds with an appropriate
// HTTP status and message, instead of always falling back to a raw 500 with
// Postgres's internal error text leaking to the client.
//
// Recognized Postgres SQLSTATE codes:
//
//	23503  foreign_key_violation        -> 400, referenced record doesn't exist
//	23505  unique_violation             -> 409, resource already exists
//	22P02  invalid_text_representation  -> 400, malformed value (e.g. bad enum/uuid)
//
// Anything else still falls back to 500 with the original error message —
// this only reclassifies errors we specifically recognize, it never hides
// a genuinely unexpected failure.
func RespondDBError(c *gin.Context, err error) {
	if pqErr, ok := err.(*pq.Error); ok {
		switch pqErr.Code {
		case "23503":
			c.JSON(http.StatusBadRequest, gin.H{"error": "referenced record does not exist"})
			return
		case "23505":
			c.JSON(http.StatusConflict, gin.H{"error": "resource already exists"})
			return
		case "22P02":
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid value in request"})
			return
		}
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
}
