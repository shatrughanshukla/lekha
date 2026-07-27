package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"mazu-banking-api/config"
	"mazu-banking-api/models"
)

// CreateAccount handles POST /accounts
func CreateAccount(c *gin.Context) {
	var input models.CreateAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		INSERT INTO accounts (company_id, account_type, current_balance, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $4)
		RETURNING id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by`

	var acc models.Account
	err := config.DB.QueryRow(query, input.CompanyID, input.AccountType, input.CurrentBalance, input.CreatedBy).
		Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
			&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, acc)
}

// GetAccounts handles GET /accounts
// Supports an optional ?company_id= query param to filter accounts for one company.
func GetAccounts(c *gin.Context) {
	companyID := c.Query("company_id")

	var rows *sql.Rows
	var err error

	if companyID != "" {
		rows, err = config.DB.Query(`
			SELECT id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by
			FROM accounts WHERE company_id = $1 ORDER BY created_at DESC`, companyID)
	} else {
		rows, err = config.DB.Query(`
			SELECT id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by
			FROM accounts ORDER BY created_at DESC`)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	accounts := []models.Account{}
	for rows.Next() {
		var acc models.Account
		if err := rows.Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
			&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		accounts = append(accounts, acc)
	}

	c.JSON(http.StatusOK, accounts)
}

// GetAccountByID handles GET /accounts/:id
func GetAccountByID(c *gin.Context) {
	id := c.Param("id")

	var acc models.Account
	query := `
		SELECT id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by
		FROM accounts WHERE id = $1`
	err := config.DB.QueryRow(query, id).
		Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
			&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, acc)
}

// UpdateAccount handles PUT /accounts/:id
// Deliberately does NOT allow editing current_balance directly — balance
// changes must go through the transfers API so the ledger stays consistent.
func UpdateAccount(c *gin.Context) {
	id := c.Param("id")

	var input models.UpdateAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		UPDATE accounts
		SET account_type = COALESCE($1, account_type),
		    is_active = COALESCE($2, is_active),
		    updated_by = $3
		WHERE id = $4
		RETURNING id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by`

	var acc models.Account
	err := config.DB.QueryRow(query, input.AccountType, input.IsActive, input.UpdatedBy, id).
		Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
			&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, acc)
}

// DeleteAccount handles DELETE /accounts/:id
func DeleteAccount(c *gin.Context) {
	id := c.Param("id")

	result, err := config.DB.Exec(`DELETE FROM accounts WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "account deleted"})
}
