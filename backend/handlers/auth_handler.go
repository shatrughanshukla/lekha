package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// signInLimiter throttles by IP+email together, not IP alone — this
// specifically slows down brute-forcing ONE account's password, without
// punishing a shared IP (office network, NAT) where many people might
// legitimately be signing into DIFFERENT accounts around the same time.
var signInLimiter = utils.NewRateLimiter(5, 15*time.Minute)

// signUpLimiter throttles by IP alone — there's no existing account to key
// against yet, and the thing being prevented here is mass account
// creation from one source, not brute-forcing a specific target.
var signUpLimiter = utils.NewRateLimiter(10, time.Hour)

// forgotPasswordLimiter throttles by IP+email — prevents someone from
// spamming a stranger's inbox with reset emails by repeatedly requesting
// them, without blocking a shared IP from resetting different accounts.
var forgotPasswordLimiter = utils.NewRateLimiter(3, 15*time.Minute)

const (
	passwordResetTokenTTL     = 1 * time.Hour
	emailVerificationTokenTTL = 24 * time.Hour
)

// frontendURL returns the base URL to build email links against. Falls
// back to a placeholder that's obviously wrong in a running email (rather
// than silently building a broken localhost link) if FRONTEND_URL isn't set.
func frontendURL() string {
	if u := os.Getenv("FRONTEND_URL"); u != "" {
		return u
	}
	return "http://SET_FRONTEND_URL_ENV_VAR"
}

// scanUserRow is the shared column list/scan order for every query that
// returns a full User row, so the SELECT/RETURNING list and the Scan calls
// across every handler never drift out of sync with each other.
const userColumns = `id, name, email, profile_picture_url, preferred_language, email_verified, created_at, updated_at`

func scanUserRow(row interface{ Scan(...interface{}) error }, u *models.User, picture *sql.NullString) error {
	return row.Scan(&u.ID, &u.Name, &u.Email, picture, &u.PreferredLanguage, &u.EmailVerified, &u.CreatedAt, &u.UpdatedAt)
}

// SignUp handles POST /api/v1/auth/signup
// Creates a new user and immediately returns a JWT, so the frontend can
// log the user straight in without a separate signin call — email
// verification is advisory (see EmailVerified on the user), not a gate on
// using the app. Also sends a verification email in the background;
// failure to send it never fails the signup itself (the person still gets
// their account either way, and can resend from the UI later).
func SignUp(c *gin.Context) {
	if !signUpLimiter.Allow(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": utils.Msg(c, "too_many_signup_attempts")})
		return
	}

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
		RETURNING ` + userColumns

	row := config.DB.QueryRow(query, input.Name, input.Email, string(hashedPassword))
	if err := scanUserRow(row, &user, &picture); err != nil {
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

	go sendVerificationEmail(user.ID, user.Email, user.Name)

	c.JSON(http.StatusCreated, models.AuthResponse{Token: token, User: user})
}

// RefreshToken handles POST /auth/refresh
// Issues a fresh 24h token for the already-authenticated caller. This is a
// PROTECTED route (goes through AuthRequired), so it requires a still-valid
// token to call — an expired token can't be refreshed this way, only a
// live one extended. A session can only ever be as long-lived as someone
// actively using the app; letting it sit unused for 24h+ still requires a
// real sign-in again.
func RefreshToken(c *gin.Context) {
	userID := c.GetString("user_id")
	email := c.GetString("user_email")

	token, err := utils.GenerateToken(userID, email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "token_gen_failed")})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

// SignIn handles POST /api/v1/auth/signin
func SignIn(c *gin.Context) {
	var input models.SignInInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	// Checked before touching the database at all — protects the DB from
	// load too, not just the account from guessing. This message is always
	// English: we don't know which user (if any) is behind this attempt
	// yet, so there's no language preference to look up.
	rateLimitKey := c.ClientIP() + ":" + input.Email
	if !signInLimiter.Allow(rateLimitKey) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": utils.Msg(c, "too_many_signin_attempts")})
		return
	}

	var user models.User
	var passwordHash string
	var picture sql.NullString
	query := `SELECT id, name, email, password_hash, profile_picture_url, preferred_language, email_verified, created_at, updated_at FROM users WHERE email = $1`
	err := config.DB.QueryRow(query, input.Email).
		Scan(&user.ID, &user.Name, &user.Email, &passwordHash, &picture, &user.PreferredLanguage, &user.EmailVerified, &user.CreatedAt, &user.UpdatedAt)

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

// ForgotPassword handles POST /auth/forgot-password
// Always responds the same way whether or not the email exists — otherwise
// this endpoint becomes a way to check which emails have accounts here.
func ForgotPassword(c *gin.Context) {
	var input models.ForgotPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	rateLimitKey := c.ClientIP() + ":" + input.Email
	if !forgotPasswordLimiter.Allow(rateLimitKey) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": utils.Msg(c, "too_many_signin_attempts")})
		return
	}

	var userID, name string
	err := config.DB.QueryRow(`SELECT id, name FROM users WHERE email = $1`, input.Email).Scan(&userID, &name)
	if err != nil {
		// sql.ErrNoRows and any other error both fall through to the same
		// generic response — see the comment on the function itself.
		c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "reset_link_sent")})
		return
	}

	raw, hash, err := utils.GenerateSecureToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "token_gen_failed")})
		return
	}

	_, err = config.DB.Exec(`
		INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
		VALUES ($1, $2, 'password_reset', $3)`,
		hash, userID, time.Now().Add(passwordResetTokenTTL))
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	link := fmt.Sprintf("%s/?reset_token=%s", frontendURL(), raw)
	html := fmt.Sprintf(`<p>Hi %s,</p><p>Someone requested a password reset for your Lekha account. If this was you, click below — this link expires in 1 hour:</p><p><a href="%s">Reset your password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`, name, link)
	go func() {
		if err := utils.SendEmail(input.Email, "Reset your Lekha password", html); err != nil {
			// Logged server-side only — the HTTP response above already
			// went out with the generic "sent" message regardless, so
			// there's no user-facing error path to report this through.
			fmt.Printf("failed to send password reset email to %s: %v\n", input.Email, err)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "reset_link_sent")})
}

// ResetPassword handles POST /auth/reset-password
func ResetPassword(c *gin.Context) {
	var input models.ResetPasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer tx.Rollback()

	hash := utils.HashToken(input.Token)
	var userID string
	var expiresAt time.Time
	var usedAt sql.NullTime
	err = tx.QueryRow(`
		SELECT user_id, expires_at, used_at FROM auth_tokens
		WHERE token_hash = $1 AND purpose = 'password_reset' FOR UPDATE`,
		hash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err == sql.ErrNoRows || usedAt.Valid || time.Now().After(expiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_or_expired_token")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "hash_failed")})
		return
	}

	if _, err := tx.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, string(newHash), userID); err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if _, err := tx.Exec(`UPDATE auth_tokens SET used_at = now() WHERE token_hash = $1`, hash); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "password_reset_success")})
}

// VerifyEmail handles POST /auth/verify-email
func VerifyEmail(c *gin.Context) {
	var input models.VerifyEmailInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer tx.Rollback()

	hash := utils.HashToken(input.Token)
	var userID string
	var expiresAt time.Time
	var usedAt sql.NullTime
	err = tx.QueryRow(`
		SELECT user_id, expires_at, used_at FROM auth_tokens
		WHERE token_hash = $1 AND purpose = 'email_verification' FOR UPDATE`,
		hash,
	).Scan(&userID, &expiresAt, &usedAt)
	if err == sql.ErrNoRows || usedAt.Valid || time.Now().After(expiresAt) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_or_expired_token")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if _, err := tx.Exec(`UPDATE users SET email_verified = true WHERE id = $1`, userID); err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if _, err := tx.Exec(`UPDATE auth_tokens SET used_at = now() WHERE token_hash = $1`, hash); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "email_verified_success")})
}

// ResendVerificationEmail handles POST /auth/resend-verification (protected —
// always sends to the CALLER's own address, never an arbitrary one, so this
// can't be used to spam someone else's inbox).
func ResendVerificationEmail(c *gin.Context) {
	userID := c.GetString("user_id")

	var email, name string
	var verified bool
	err := config.DB.QueryRow(`SELECT email, name, email_verified FROM users WHERE id = $1`, userID).Scan(&email, &name, &verified)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "user_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if verified {
		c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "email_already_verified")})
		return
	}

	if err := sendVerificationEmail(userID, email, name); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": utils.Msg(c, "email_send_failed")})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "verification_email_sent")})
}

// sendVerificationEmail generates a fresh token and emails the verification
// link. Shared by SignUp (fire-and-forget in a goroutine) and
// ResendVerificationEmail (synchronous, so the caller knows whether it
// actually went out).
func sendVerificationEmail(userID, email, name string) error {
	raw, hash, err := utils.GenerateSecureToken()
	if err != nil {
		return err
	}

	_, err = config.DB.Exec(`
		INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at)
		VALUES ($1, $2, 'email_verification', $3)`,
		hash, userID, time.Now().Add(emailVerificationTokenTTL))
	if err != nil {
		return err
	}

	link := fmt.Sprintf("%s/?verify_token=%s", frontendURL(), raw)
	html := fmt.Sprintf(`<p>Hi %s,</p><p>Welcome to Lekha — click below to verify your email address. This link expires in 24 hours:</p><p><a href="%s">Verify your email</a></p>`, name, link)
	return utils.SendEmail(email, "Verify your Lekha email", html)
}
