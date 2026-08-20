package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// CreateTransfer handles POST /transfers
//
// This is the one endpoint with real business logic: moving money between
// two accounts has to be atomic (either both the debit and the credit
// happen, or neither does), so everything runs inside a single DB
// transaction with row locks to prevent two concurrent transfers from
// reading a stale balance for the same account.
//
// Authorization model — this is the important part:
//
//	The transfer's company (whose books it's recorded under) is derived
//	from from_account_id's REAL owning company, looked up server-side —
//	never trusted from client input. The requester must be a member of
//	THAT company, because that's the account they're authorizing money to
//	leave from. to_account_id has NO membership requirement at all: you
//	can send money to any account that exists, in any company, exactly
//	like sending a real bank transfer to someone else's account without
//	needing access to their bank statement. This also means a user who
//	belongs to several companies can freely move money between accounts
//	in different companies they own — the old version of this handler
//	incorrectly required a client-supplied company_id and only checked
//	membership on that, which never actually verified from_account
//	belonged to a company the requester controlled at all.
func CreateTransfer(c *gin.Context) {
	var input models.CreateTransferInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer tx.Rollback() // no-op once tx.Commit() succeeds

	// Lock the source account row and read its real owning company in the
	// same query, so no other transfer can read/modify its balance until
	// this transaction commits or rolls back.
	var fromBalance float64
	var fromActive bool
	var fromCompanyID string
	err = tx.QueryRow(
		`SELECT current_balance, is_active, company_id FROM accounts WHERE id = $1 FOR UPDATE`,
		input.FromAccountID,
	).Scan(&fromBalance, &fromActive, &fromCompanyID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "from_account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	// The requester must control the source account — i.e. be a member of
	// the company it actually belongs to. Returns the same "not found"
	// message as a missing account so an outsider can't tell the
	// difference between "doesn't exist" and "exists but isn't yours".
	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(fromCompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "from_account not found"})
		return
	}

	if !fromActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_account is not active"})
		return
	}
	if fromBalance < input.Amount {
		c.JSON(http.StatusBadRequest, gin.H{"error": "insufficient balance in from_account"})
		return
	}

	// Confirm the destination account exists and is active. Deliberately NO
	// membership check here — the destination can belong to any company,
	// same as sending money to someone else's real bank account.
	var toActive bool
	err = tx.QueryRow(
		`SELECT is_active FROM accounts WHERE id = $1 FOR UPDATE`,
		input.ToAccountID,
	).Scan(&toActive)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "to_account not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !toActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "to_account is not active"})
		return
	}

	// Debit the source, credit the destination.
	if _, err = tx.Exec(
		`UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2`,
		input.Amount, input.FromAccountID,
	); err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if _, err = tx.Exec(
		`UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2`,
		input.Amount, input.ToAccountID,
	); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	// Record the transfer under the SOURCE account's real company —
	// derived above, never the client's word for it. Marked COMPLETED
	// since the balances above already moved.
	var transfer models.Transfer
	insertQuery := `
		INSERT INTO transfers (
			company_id, transfer_type, from_account_id, to_account_id,
			amount, status, transfer_notes, created_by_user, updated_by_user
		)
		VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6, $7, $7)
		RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at`

	err = tx.QueryRow(insertQuery,
		fromCompanyID, input.TransferType, input.FromAccountID, input.ToAccountID,
		input.Amount, input.TransferNotes, input.CreatedByUser,
	).Scan(&transfer.ID, &transfer.CompanyID, &transfer.TransferType, &transfer.TransactionDate,
		&transfer.FromAccountID, &transfer.ToAccountID, &transfer.Amount, &transfer.Status,
		&transfer.TransferNotes, &transfer.CreatedByUser, &transfer.UpdatedByUser,
		&transfer.CreatedAt, &transfer.UpdatedAt)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, transfer)
}

// GetTransfers handles GET /transfers
// company_id is required — without it there'd be no way to scope results
// to companies the requester actually belongs to. account_id and status
// remain optional additional filters.
//
// Matches a transfer if the queried company is EITHER the sender's or the
// receiver's — this is what makes a cross-company/external transfer show
// up in both companies' transfer histories, not just the sender's. It also
// joins in company names, account types, and creator/updater names so the
// UI can show "from which company/account to which" without extra calls.
func GetTransfers(c *gin.Context) {
	companyID := c.Query("company_id")
	accountID := c.Query("account_id")
	status := c.Query("status")

	if companyID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "company_id query parameter is required"})
		return
	}
	if !utils.IsValidUUID(companyID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid company_id format, expected a UUID"})
		return
	}
	if accountID != "" && !utils.IsValidUUID(accountID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid account_id format, expected a UUID"})
		return
	}
	if status != "" && !utils.IsValidTransferStatus(status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status value"})
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

	query := `
		SELECT t.id, t.company_id, t.transfer_type, t.transaction_date, t.from_account_id, t.to_account_id,
		       t.amount, t.status, t.transfer_notes, t.created_by_user, t.updated_by_user, t.created_at, t.updated_at,
		       fc.company_name, tc.company_name, fa.account_type, ta.account_type, cu.name, uu.name
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN company fc ON fc.id = fa.company_id
		JOIN accounts ta ON ta.id = t.to_account_id
		JOIN company tc ON tc.id = ta.company_id
		JOIN users cu ON cu.id = t.created_by_user
		JOIN users uu ON uu.id = t.updated_by_user
		WHERE (fa.company_id = $1::uuid OR ta.company_id = $1::uuid)
		  AND ($2 = '' OR t.from_account_id = $2::uuid OR t.to_account_id = $2::uuid)
		  AND ($3 = '' OR t.status = $3::transfer_status_enum)
		ORDER BY t.created_at DESC`

	rows, err := config.DB.Query(query, companyID, accountID, status)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	transfers := []models.Transfer{}
	for rows.Next() {
		var t models.Transfer
		if err := rows.Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
			&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
			&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt,
			&t.FromCompanyName, &t.ToCompanyName, &t.FromAccountType, &t.ToAccountType,
			&t.CreatedByName, &t.UpdatedByName); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		transfers = append(transfers, t)
	}

	c.JSON(http.StatusOK, transfers)
}

// GetTransferByID handles GET /transfers/:id
// Viewable by a member of EITHER the sending or receiving company — same
// "either side" logic as GetTransfers above, and the same joined display
// fields for the transaction detail view.
func GetTransferByID(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	fromCompanyID, toCompanyID, err := utils.PartyCompanyIDsForTransfer(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	userID := c.GetString("user_id")
	isSenderMember, err := utils.IsCompanyMember(fromCompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	isReceiverMember, err := utils.IsCompanyMember(toCompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isSenderMember && !isReceiverMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}

	var t models.Transfer
	err = config.DB.QueryRow(`
		SELECT t.id, t.company_id, t.transfer_type, t.transaction_date, t.from_account_id, t.to_account_id,
		       t.amount, t.status, t.transfer_notes, t.created_by_user, t.updated_by_user, t.created_at, t.updated_at,
		       fc.company_name, tc.company_name, fa.account_type, ta.account_type, cu.name, uu.name
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN company fc ON fc.id = fa.company_id
		JOIN accounts ta ON ta.id = t.to_account_id
		JOIN company tc ON tc.id = ta.company_id
		JOIN users cu ON cu.id = t.created_by_user
		JOIN users uu ON uu.id = t.updated_by_user
		WHERE t.id = $1`, id).
		Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
			&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
			&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt,
			&t.FromCompanyName, &t.ToCompanyName, &t.FromAccountType, &t.ToAccountType,
			&t.CreatedByName, &t.UpdatedByName)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, t)
}

// UpdateTransferStatus handles PATCH /transfers/:id/status
// Used for marking a transfer FAILED / CANCELLED / REVERSED after the fact.
// NOTE: this does not automatically reverse the account balances — a real
// "REVERSED" flow should credit/debit the accounts back, which would reuse
// the same transactional pattern as CreateTransfer above.
func UpdateTransferStatus(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	companyID, err := utils.CompanyIDForTransfer(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
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
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}

	var input models.UpdateTransferStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var t models.Transfer
	err = config.DB.QueryRow(`
		UPDATE transfers
		SET status = $1, updated_by_user = $2
		WHERE id = $3
		RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at`,
		input.Status, input.UpdatedByUser, id,
	).Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
		&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
		&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, t)
}
