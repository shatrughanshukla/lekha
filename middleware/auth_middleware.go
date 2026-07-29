package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lekha-api/utils"
)

// AuthRequired blocks any request that doesn't carry a valid JWT in the
// Authorization header, and makes the signed-in user's id available to
// handlers via c.Get("user_id").
//
// Expected header: Authorization: Bearer <token>
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "expected format: Bearer <token>"})
			return
		}

		claims, err := utils.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		// Handlers can read these with c.GetString("user_id") / c.GetString("user_email")
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Next()
	}
}
