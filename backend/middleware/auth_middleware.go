package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/utils"
)

// AuthRequired blocks any request that doesn't carry a valid JWT in the
// Authorization header, and makes the signed-in user's id available to
// handlers via c.Get("user_id"). It also resolves their preferred_language
// and sets it on the context (c.Get("lang")) so every response — not just
// the ones that happen to remember to check — can be localized via
// utils.Msg(c, ...).
//
// Expected header: Authorization: Bearer <token>
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": utils.Msg(c, "missing_auth_header")})
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": utils.Msg(c, "bad_auth_format")})
			return
		}

		claims, err := utils.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": utils.Msg(c, "invalid_token")})
			return
		}

		// Handlers can read these with c.GetString("user_id") / c.GetString("user_email")
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)

		// Best-effort: if this lookup fails for any reason, fall through
		// with the English default (utils.LangFromContext) rather than
		// blocking the request over a non-critical preference lookup.
		var lang string
		if err := config.DB.QueryRow(`SELECT preferred_language FROM users WHERE id = $1`, claims.UserID).Scan(&lang); err == nil && utils.IsValidLang(lang) {
			c.Set("lang", utils.Lang(lang))
		}

		c.Next()
	}
}
