package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// CreateAccount handles POST /accounts
// Requires the requester to be a member of the target company — otherwise
// anyone with a valid token could open an account under any company_id.
func CreateAccount(c *gin.Context) {
	var input models.CreateAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(input.CompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	var acc models.Account
	err = config.DB.QueryRow(`
		INSERT INTO accounts (company_id, account_type, current_balance, created_by, updated_by)
		VALUES ($1, $2, $3, $4, $4)
		RETURNING id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by`,
		input.CompanyID, input.AccountType, input.CurrentBalance, input.CreatedBy,
	).Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
		&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, acc)
}

// GetAccounts handles GET /accounts
// company_id is now REQUIRED (previously optional) — without it there was
// no way to scope results to companies the requester actually belongs to,
// and it would have returned every account in the entire database.
func GetAccounts(c *gin.Context) {
	companyID := c.Query("company_id")

	if companyID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "company_id query parameter is required"})
		return
	}
	if !utils.IsValidUUID(companyID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company_id format, expected a UUID"})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by
		FROM accounts WHERE company_id = $1 ORDER BY created_at DESC`, companyID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	accounts := []models.Account{}
	for rows.Next() {
		var acc models.Account
		if err := rows.Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
			&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		accounts = append(accounts, acc)
	}

	c.JSON(http.StatusOK, accounts)
}

// GetAccountByID handles GET /accounts/:id
func GetAccountByID(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	companyID, err := utils.CompanyIDForAccount(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}

	var acc models.Account
	err = config.DB.QueryRow(`
		SELECT id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by
		FROM accounts WHERE id = $1`, id).
		Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
			&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, acc)
}

// UpdateAccount handles PUT /accounts/:id
// Deliberately does NOT allow editing current_balance directly — balance
// changes must go through the transfers API so the ledger stays consistent.
func UpdateAccount(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	companyID, err := utils.CompanyIDForAccount(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}

	var input models.UpdateAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var acc models.Account
	err = config.DB.QueryRow(`
		UPDATE accounts
		SET account_type = COALESCE($1, account_type),
		    is_active = COALESCE($2, is_active),
		    updated_by = $3
		WHERE id = $4
		RETURNING id, company_id, account_type, current_balance, is_active, created_at, updated_at, created_by, updated_by`,
		input.AccountType, input.IsActive, input.UpdatedBy, id,
	).Scan(&acc.ID, &acc.CompanyID, &acc.AccountType, &acc.CurrentBalance, &acc.IsActive,
		&acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, acc)
}

// DeleteAccount handles DELETE /accounts/:id
func DeleteAccount(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	companyID, err := utils.CompanyIDForAccount(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}

	result, err := config.DB.Exec(`DELETE FROM accounts WHERE id = $1`, id)
	if err != nil {
		// Most commonly hit here: the account still has transfers
		// referencing it — a foreign-key violation, now returned as a
		// clean 400 instead of a raw 500.
		utils.RespondDBError(c, err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "account not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "account deleted"})
}
