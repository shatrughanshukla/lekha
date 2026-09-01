package main

import (
	"log"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"lekha-api/config"
	"lekha-api/routes"
)

// defaultDevOrigins are allowed even when ALLOWED_ORIGINS isn't set, so
// local development keeps working out of the box. Production deployments
// should always set ALLOWED_ORIGINS explicitly rather than relying on this.
var defaultDevOrigins = []string{
	"http://localhost:5173",
	"http://127.0.0.1:5173",
}

// parseAllowedOrigins turns a comma-separated ALLOWED_ORIGINS value into a
// lookup set. Empty entries and surrounding whitespace are ignored. Falls
// back to defaultDevOrigins when the env var is unset or empty.
func parseAllowedOrigins(raw string) map[string]bool {
	set := map[string]bool{}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		for _, o := range defaultDevOrigins {
			set[o] = true
		}
		return set
	}
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			set[o] = true
		}
	}
	return set
}

func main() {
	// Load environment variables from .env (ignored if the file doesn't exist,
	// e.g. in production where env vars are set by the host instead).
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from actual environment variables")
	}

	config.ConnectDB()

	router := gin.Default()

	// CORS: restricted to actual known origins rather than "*". Configure
	// via ALLOWED_ORIGINS (comma-separated) in production — e.g.
	// ALLOWED_ORIGINS=https://lekha-six-alpha.vercel.app. Falls back to
	// common local dev ports if unset, so local development still works
	// out of the box without needing this var.
	allowedOrigins := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if allowedOrigins[origin] {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	routes.RegisterRoutes(router)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("server starting on port %s\n", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("server failed to start: %v", err)
	}
}
