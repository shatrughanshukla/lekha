package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
)

// CreateTransfer handles POST /transfers
//
// This is the one endpoint with real business logic: moving money between
// two accounts has to be atomic (either both the debit and the credit
// happen, or neither does), so everything runs inside a single DB
// transaction with row locks to prevent two concurrent transfers from
// reading a stale balance for the same account.
func CreateTransfer(c *gin.Context) {
	var input models.CreateTransferInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer tx.Rollback() // no-op once tx.Commit() succeeds

	// Lock the source account row so no other transfer can read/modify its
	// balance until this transaction commits or rolls back.
	var fromBalance float64
	var fromActive bool
	err = tx.QueryRow(
		`SELECT current_balance, is_active FROM accounts WHERE id = $1 FOR UPDATE`,
		input.FromAccountID,
	).Scan(&fromBalance, &fromActive)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "from_account not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	// Confirm the destination account exists and is active too.
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if _, err = tx.Exec(
		`UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2`,
		input.Amount, input.ToAccountID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Record the transfer itself, marked COMPLETED since the balances above
	// already moved. Swap to 'PENDING' here if your flow needs an approval
	// step before money actually moves.
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
		input.CompanyID, input.TransferType, input.FromAccountID, input.ToAccountID,
		input.Amount, input.TransferNotes, input.CreatedByUser,
	).Scan(&transfer.ID, &transfer.CompanyID, &transfer.TransferType, &transfer.TransactionDate,
		&transfer.FromAccountID, &transfer.ToAccountID, &transfer.Amount, &transfer.Status,
		&transfer.TransferNotes, &transfer.CreatedByUser, &transfer.UpdatedByUser,
		&transfer.CreatedAt, &transfer.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, transfer)
}

// GetTransfers handles GET /transfers
// Supports optional filters: ?company_id=, ?account_id=, ?status=
func GetTransfers(c *gin.Context) {
	companyID := c.Query("company_id")
	accountID := c.Query("account_id")
	status := c.Query("status")

	query := `
		SELECT id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		       amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at
		FROM transfers
		WHERE ($1 = '' OR company_id = $1::uuid)
		  AND ($2 = '' OR from_account_id = $2::uuid OR to_account_id = $2::uuid)
		  AND ($3 = '' OR status = $3)
		ORDER BY created_at DESC`

	rows, err := config.DB.Query(query, companyID, accountID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	transfers := []models.Transfer{}
	for rows.Next() {
		var t models.Transfer
		if err := rows.Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
			&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
			&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		transfers = append(transfers, t)
	}

	c.JSON(http.StatusOK, transfers)
}

// GetTransferByID handles GET /transfers/:id
func GetTransferByID(c *gin.Context) {
	id := c.Param("id")

	var t models.Transfer
	query := `
		SELECT id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		       amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at
		FROM transfers WHERE id = $1`
	err := config.DB.QueryRow(query, id).
		Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
			&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
			&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

	var input models.UpdateTransferStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		UPDATE transfers
		SET status = $1, updated_by_user = $2
		WHERE id = $3
		RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at`

	var t models.Transfer
	err := config.DB.QueryRow(query, input.Status, input.UpdatedByUser, id).
		Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
			&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
			&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, t)
}
