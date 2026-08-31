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
// log the user straight in without a separate signin call. There is no
// language preference to look up yet (the user doesn't exist until this
// request succeeds), so any error here is in English by default — see
// SignIn below for how a RETURNING user's language is honored instead.
func SignUp(c *gin.Context) {
	var input models.SignUpInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "hash_failed")})
		return
	}

	var user models.User
	var picture sql.NullString
	query := `
		INSERT INTO users (name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, name, email, profile_picture_url, preferred_language, created_at, updated_at`

	err = config.DB.QueryRow(query, input.Name, input.Email, string(hashedPassword)).
		Scan(&user.ID, &user.Name, &user.Email, &picture, &user.PreferredLanguage, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		// utils.RespondDBError correctly returns 409 for a genuine unique
		// constraint violation on email, and a real 500 for anything else —
		// rather than blanket-labeling every possible failure as a conflict.
		utils.RespondDBError(c, err)
		return
	}
	user.ProfilePictureURL = utils.NullStringToPtr(picture)

	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "token_gen_failed")})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{Token: token, User: user})
}

// SignIn handles POST /api/v1/auth/signin
func SignIn(c *gin.Context) {
	var input models.SignInInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	var user models.User
	var passwordHash string
	var picture sql.NullString
	query := `SELECT id, name, email, password_hash, profile_picture_url, preferred_language, created_at, updated_at FROM users WHERE email = $1`
	err := config.DB.QueryRow(query, input.Email).
		Scan(&user.ID, &user.Name, &user.Email, &passwordHash, &picture, &user.PreferredLanguage, &user.CreatedAt, &user.UpdatedAt)

	if err == sql.ErrNoRows {
		// Deliberately vague — don't reveal whether the email exists. No
		// user row means no language preference to honor either, so this
		// one error is always in English regardless of what the person
		// meant to sign in as.
		c.JSON(http.StatusUnauthorized, gin.H{"error": utils.Msg(c, "invalid_email_or_password")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	user.ProfilePictureURL = utils.NullStringToPtr(picture)

	// The user row exists — even on a wrong-password failure below, honor
	// their saved language preference for the error message itself.
	if utils.IsValidLang(user.PreferredLanguage) {
		c.Set("lang", utils.Lang(user.PreferredLanguage))
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": utils.Msg(c, "invalid_email_or_password")})
		return
	}

	token, err := utils.GenerateToken(user.ID, user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "token_gen_failed")})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{Token: token, User: user})
}
