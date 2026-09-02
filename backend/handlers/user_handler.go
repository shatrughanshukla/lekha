package handlers

import (
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// Note: there is no CreateUser handler here anymore — creating a user now
// happens exclusively through POST /auth/signup (see auth_handler.go), which
// does the same insert but also returns a JWT so a new user is logged in
// immediately. Keeping a second, separate "create user" path around would
// just be two ways to do the same thing.
//
// userColumns and scanUserRow (shared with auth_handler.go) keep every
// query that returns a User in sync — add a column once, in one place,
// rather than hunting down every SELECT/RETURNING list by hand.

// GetUsers handles GET /users
func GetUsers(c *gin.Context) {
	rows, err := config.DB.Query(`SELECT ` + userColumns + ` FROM users ORDER BY created_at DESC`)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		var picture sql.NullString
		if err := scanUserRow(rows, &u, &picture); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		u.ProfilePictureURL = utils.NullStringToPtr(picture)
		users = append(users, u)
	}

	c.JSON(http.StatusOK, users)
}

// GetUserByID handles GET /users/:id
func GetUserByID(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	var u models.User
	var picture sql.NullString
	row := config.DB.QueryRow(`SELECT `+userColumns+` FROM users WHERE id = $1`, id)
	err := scanUserRow(row, &u, &picture)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "user_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	u.ProfilePictureURL = utils.NullStringToPtr(picture)

	c.JSON(http.StatusOK, u)
}

// UpdateUser handles PUT /users/:id
// Updates whichever of name / email / preferred_language are present in
// the payload — profile_picture_url goes through the dedicated
// upload/remove endpoints instead (see below), since COALESCE here can
// never be used to explicitly clear a field back to NULL.
//
// Known simplification: changing email does NOT reset email_verified back
// to false. A user could change their email to one they don't own and
// keep showing as "verified" for an address that isn't actually theirs.
// Re-verification-on-email-change isn't implemented yet.
func UpdateUser(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	var input models.UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	query := `
		UPDATE users
		SET name = COALESCE($1, name),
		    email = COALESCE($2, email),
		    profile_picture_url = COALESCE($3, profile_picture_url),
		    preferred_language = COALESCE($4, preferred_language)
		WHERE id = $5
		RETURNING ` + userColumns

	var u models.User
	var picture sql.NullString
	row := config.DB.QueryRow(query, input.Name, input.Email, input.ProfilePictureURL, input.PreferredLanguage, id)
	err := scanUserRow(row, &u, &picture)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "user_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	u.ProfilePictureURL = utils.NullStringToPtr(picture)

	c.JSON(http.StatusOK, u)
}

// DeleteUser handles DELETE /users/:id
func DeleteUser(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	result, err := config.DB.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "user_not_found")})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "user_deleted")})
}

// ChangePassword handles PATCH /users/:id/password
// Requires the current password to match before setting a new one — same
// principle as the profile-picture endpoints: a user can only do this to
// their own account, verified by comparing c.GetString("user_id") to :id,
// never trusting the URL alone.
func ChangePassword(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	if requesterID := c.GetString("user_id"); requesterID != id {
		c.JSON(http.StatusForbidden, gin.H{"error": utils.Msg(c, "own_password_only")})
		return
	}

	var input models.ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	var currentHash string
	err := config.DB.QueryRow(`SELECT password_hash FROM users WHERE id = $1`, id).Scan(&currentHash)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "user_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(input.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": utils.Msg(c, "incorrect_current_password")})
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "hash_failed")})
		return
	}

	if _, err := config.DB.Exec(`UPDATE users SET password_hash = $1 WHERE id = $2`, string(newHash), id); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "password_changed")})
}

// allowedProfilePictureTypes are the image formats we'll accept and their
// canonical file extension for the stored object path.
var allowedProfilePictureTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

const maxProfilePictureBytes = 5 * 1024 * 1024 // 5MB

// UploadProfilePicture handles POST /users/:id/profile-picture
// Expects multipart/form-data with a "photo" file field. Only the signed-in
// user may set their own picture.
func UploadProfilePicture(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	// A user can only change their own profile picture.
	if requesterID := c.GetString("user_id"); requesterID != id {
		c.JSON(http.StatusForbidden, gin.H{"error": utils.Msg(c, "own_picture_only")})
		return
	}

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "no_photo_provided")})
		return
	}

	if fileHeader.Size > maxProfilePictureBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "photo_too_large")})
		return
	}

	contentType := fileHeader.Header.Get("Content-Type")
	ext, ok := allowedProfilePictureTypes[contentType]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "unsupported_image_type")})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "could_not_read_file")})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "could_not_read_file")})
		return
	}

	// Deterministic path per user (not per-upload) so re-uploading replaces
	// the old picture in storage instead of accumulating orphaned files.
	objectPath := fmt.Sprintf("%s%s", id, ext)
	// Guard against any path traversal sneaking in via a crafted extension.
	objectPath = strings.ReplaceAll(filepath.Clean(objectPath), "..", "")

	publicURL, err := utils.UploadToSupabaseStorage(objectPath, contentType, data)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": utils.Msg(c, "photo_upload_failed") + err.Error()})
		return
	}

	// Cache-bust: browsers/CDNs may cache the previous image at this same
	// URL, so append a query string that changes on every upload.
	publicURL = fmt.Sprintf("%s?v=%d", publicURL, time.Now().Unix())

	query := `
		UPDATE users
		SET profile_picture_url = $1
		WHERE id = $2
		RETURNING ` + userColumns

	var u models.User
	var picture sql.NullString
	row := config.DB.QueryRow(query, publicURL, id)
	if err := scanUserRow(row, &u, &picture); err != nil {
		utils.RespondDBError(c, err)
		return
	}
	u.ProfilePictureURL = utils.NullStringToPtr(picture)

	c.JSON(http.StatusOK, u)
}

// RemoveProfilePicture handles DELETE /users/:id/profile-picture
// Clears the user's profile_picture_url. This is deliberately a separate
// endpoint rather than relying on PUT /users/:id — that handler uses
// COALESCE to merge partial updates, which means it can never be used to
// explicitly clear a field back to NULL.
func RemoveProfilePicture(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	if requesterID := c.GetString("user_id"); requesterID != id {
		c.JSON(http.StatusForbidden, gin.H{"error": utils.Msg(c, "own_picture_only")})
		return
	}

	query := `
		UPDATE users
		SET profile_picture_url = NULL
		WHERE id = $1
		RETURNING ` + userColumns

	var u models.User
	var picture sql.NullString
	row := config.DB.QueryRow(query, id)
	err := scanUserRow(row, &u, &picture)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "user_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	u.ProfilePictureURL = utils.NullStringToPtr(picture)

	c.JSON(http.StatusOK, u)
}
