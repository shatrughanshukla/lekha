package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// lowBalanceThreshold is the line below which an active account gets
// flagged as worth deactivating, and above which an inactive one gets
// flagged as worth reactivating. Purely advisory — see Account.SuggestedAction.
const lowBalanceThreshold = 1000.0

// suggestedAccountAction computes an advisory suggestion from an account's
// current balance and active state. Nothing calls this automatically in
// response to a balance change — it's recomputed fresh every time an
// account is read, so it's always consistent with the real numbers, never
// a stored flag that could drift out of date.
func suggestedAccountAction(balance float64, isActive bool) *string {
	switch {
	case isActive && balance < lowBalanceThreshold:
		s := "deactivate"
		return &s
	case !isActive && balance >= lowBalanceThreshold:
		s := "reactivate"
		return &s
	default:
		return nil
	}
}

// CreateAccount handles POST /accounts
// Requires the requester to be a member of the target company — otherwise
// anyone with a valid token could open an account under any company_id.
func CreateAccount(c *gin.Context) {
	var input models.CreateAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(input.CompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "company_not_found")})
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
	acc.SuggestedAction = suggestedAccountAction(acc.CurrentBalance, acc.IsActive)

	c.JSON(http.StatusCreated, acc)
}

// GetAccounts handles GET /accounts
//
// Two modes:
//   - ?company_id=<id>  -> accounts for that one company (requester must be
//     a member of it). Used by the company detail page.
//   - no company_id     -> every account across EVERY company the requester
//     is a member of, with each account's company_name joined in. Used by
//     the transfer "from" picker, so a user can move money between accounts
//     in different companies they belong to, not just within one company.
//
// Either way, this only ever returns accounts the requester actually has
// access to — never another user's accounts.
func GetAccounts(c *gin.Context) {
	companyID := c.Query("company_id")
	userID := c.GetString("user_id")

	if companyID != "" {
		if !utils.IsValidUUID(companyID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_company_id")})
			return
		}
		isMember, err := utils.IsCompanyMember(companyID, userID)
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
		if !isMember {
			c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "company_not_found")})
			return
		}

		rows, err := config.DB.Query(`
			SELECT a.id, a.company_id, co.company_name, a.account_type, a.current_balance,
			       a.is_active, a.created_at, a.updated_at, a.created_by, a.updated_by
			FROM accounts a
			JOIN company co ON co.id = a.company_id
			WHERE a.company_id = $1 ORDER BY a.created_at DESC`, companyID)
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
		defer rows.Close()
		writeAccountRows(c, rows)
		return
	}

	// No company_id: every account across every company this user belongs to.
	rows, err := config.DB.Query(`
		SELECT a.id, a.company_id, co.company_name, a.account_type, a.current_balance,
		       a.is_active, a.created_at, a.updated_at, a.created_by, a.updated_by
		FROM accounts a
		JOIN company co ON co.id = a.company_id
		JOIN company_members cm ON cm.company_id = a.company_id
		WHERE cm.user_id = $1
		ORDER BY co.company_name, a.created_at DESC`, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()
	writeAccountRows(c, rows)
}

// writeAccountRows scans a rows result of the (id, company_id, company_name,
// account_type, current_balance, is_active, created_at, updated_at,
// created_by, updated_by) shape and writes it as the JSON response — shared
// by both branches of GetAccounts above since they select the same columns.
func writeAccountRows(c *gin.Context, rows *sql.Rows) {
	accounts := []models.Account{}
	for rows.Next() {
		var acc models.Account
		if err := rows.Scan(&acc.ID, &acc.CompanyID, &acc.CompanyName, &acc.AccountType, &acc.CurrentBalance,
			&acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		acc.SuggestedAction = suggestedAccountAction(acc.CurrentBalance, acc.IsActive)
		accounts = append(accounts, acc)
	}
	c.JSON(http.StatusOK, accounts)
}

// GetAccountByID handles GET /accounts/:id
func GetAccountByID(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	companyID, err := utils.CompanyIDForAccount(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
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
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
		return
	}

	var acc models.Account
	err = config.DB.QueryRow(`
		SELECT a.id, a.company_id, co.company_name, a.account_type, a.current_balance,
		       a.is_active, a.created_at, a.updated_at, a.created_by, a.updated_by
		FROM accounts a
		JOIN company co ON co.id = a.company_id
		WHERE a.id = $1`, id).
		Scan(&acc.ID, &acc.CompanyID, &acc.CompanyName, &acc.AccountType, &acc.CurrentBalance,
			&acc.IsActive, &acc.CreatedAt, &acc.UpdatedAt, &acc.CreatedBy, &acc.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	acc.SuggestedAction = suggestedAccountAction(acc.CurrentBalance, acc.IsActive)

	c.JSON(http.StatusOK, acc)
}

// UpdateAccount handles PUT /accounts/:id
// Deliberately does NOT allow editing current_balance directly — balance
// changes must go through the transfers API so the ledger stays consistent.
func UpdateAccount(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	companyID, err := utils.CompanyIDForAccount(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
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
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
		return
	}

	var input models.UpdateAccountInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	// Activating/deactivating an account freezes or unfreezes real money
	// movement (CreateTransfer rejects transfers on an inactive account) —
	// that's a bigger decision than editing an account's type, so it's
	// restricted to admins even though plain members can otherwise manage
	// accounts. account_type changes stay open to any member.
	if input.IsActive != nil {
		isAdmin, err := utils.IsCompanyAdmin(companyID, userID)
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": utils.Msg(c, "only_admin_activate")})
			return
		}
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
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	acc.SuggestedAction = suggestedAccountAction(acc.CurrentBalance, acc.IsActive)

	c.JSON(http.StatusOK, acc)
}

// DeleteAccount handles DELETE /accounts/:id
func DeleteAccount(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	companyID, err := utils.CompanyIDForAccount(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
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
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
		return
	}

	result, err := config.DB.Exec(`DELETE FROM accounts WHERE id = $1`, id)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "account_not_found")})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "account_deleted")})
}
