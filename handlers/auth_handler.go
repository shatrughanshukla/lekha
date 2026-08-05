package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// SignUp handles POST /api/v1/auth/signup
// Creates a new user and immediately returns a JWT, so the frontend can
// log the user straight in without a separate signin call.
func SignUp(c *gin.Context) {
	var input models.SignUpInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	var user models.User
	query := `
		INSERT INTO users (name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, name, email, created_at, updated_at`

	err = config.DB.QueryRow(query, input.Name, input.Email, string(hashedPassword)).
		Scan(&user.ID, &user.Name, &user.Email, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		// utils.RespondDBError correctly returns 409 for a genuine unique
		// constraint violation on email, and a real 500 for anything else —
		// rather than blanket-labeling every possible failure as a conflict.
		utils.RespondDBError(c, err)
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{Token: token, User: user})
}

// SignIn handles POST /api/v1/auth/signin
func SignIn(c *gin.Context) {
	var input models.SignInInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	var passwordHash string
	query := `SELECT id, name, email, password_hash, created_at, updated_at FROM users WHERE email = $1`
	err := config.DB.QueryRow(query, input.Email).
		Scan(&user.ID, &user.Name, &user.Email, &passwordHash, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Deliberately vague — don't reveal whether the email exists.
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{Token: token, User: user})
}
