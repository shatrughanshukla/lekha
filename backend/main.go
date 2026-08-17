package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"lekha-api/config"
	"lekha-api/routes"
)

func main() {
	// Load environment variables from .env (ignored if the file doesn't exist,
	// e.g. in production where env vars are set by the host instead).
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from actual environment variables")
	}

	config.ConnectDB()

	router := gin.Default()

	// CORS: the frontend runs on a different port (Vite's dev server, usually
	// :5173) than this API (:8080), so browsers block requests between them
	// by default unless the server explicitly allows it. Wide open ("*") is
	// fine for local development; a real deployment would restrict this to
	// the frontend's actual domain.
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
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
