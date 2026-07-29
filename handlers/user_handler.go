package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
)

// Note: there is no CreateUser handler here anymore — creating a user now
// happens exclusively through POST /auth/signup (see auth_handler.go), which
// does the same insert but also returns a JWT so a new user is logged in
// immediately. Keeping a second, separate "create user" path around would
// just be two ways to do the same thing.

// GetUsers handles GET /users
func GetUsers(c *gin.Context) {
	rows, err := config.DB.Query(`SELECT id, name, email, created_at, updated_at FROM users ORDER BY created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []models.User{}
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt, &u.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		users = append(users, u)
	}

	c.JSON(http.StatusOK, users)
}

// GetUserByID handles GET /users/:id
func GetUserByID(c *gin.Context) {
	id := c.Param("id")

	var u models.User
	query := `SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1`
	err := config.DB.QueryRow(query, id).Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt, &u.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, u)
}

// UpdateUser handles PUT /users/:id
// Only name and/or email are updated — whichever fields are present in the payload.
func UpdateUser(c *gin.Context) {
	id := c.Param("id")

	var input models.UpdateUserInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		UPDATE users
		SET name = COALESCE($1, name),
		    email = COALESCE($2, email)
		WHERE id = $3
		RETURNING id, name, email, created_at, updated_at`

	var u models.User
	err := config.DB.QueryRow(query, input.Name, input.Email, id).
		Scan(&u.ID, &u.Name, &u.Email, &u.CreatedAt, &u.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, u)
}

// DeleteUser handles DELETE /users/:id
func DeleteUser(c *gin.Context) {
	id := c.Param("id")

	result, err := config.DB.Exec(`DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "user deleted"})
}
