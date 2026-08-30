package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// ---------------------------------------------------------------------------
// The two-party approval state machine, in full:
//
//   PENDING    — a transfer that's been requested but not yet agreed to.
//                No money has moved. Only the RECEIVING company can move it
//                to COMPLETED (which is also the moment the money actually
//                moves); either side can move it to CANCELLED.
//
//   COMPLETED  — money has moved. This is terminal EXCEPT that either side
//                may PROPOSE reversing it — which does not change anything
//                yet. The transfer keeps showing COMPLETED, with a
//                PendingStatus of REVERSED attached, until the OTHER side
//                (not the one who proposed it) approves or rejects that
//                proposal. Only approval actually reverses the balances.
//
//   CANCELLED  — terminal. A PENDING transfer that either side rejected.
//                Money never moved for it.
//
//   REVERSED   — terminal. A COMPLETED transfer that both sides agreed to
//                undo. The balances have been moved back.
//
// Every state transition that touches money goes through RespondToTransfer
// below — CreateTransfer and ProposeTransferStatus never move a balance by
// themselves except for the "both sides are the same person" shortcut
// (see isBothSides below), where there's genuinely no one else to wait on.
// ---------------------------------------------------------------------------

// CreateTransfer handles POST /transfers
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
//	needing access to their bank statement.
//
// Money model: a transfer created between two companies you don't control
// both sides of starts PENDING and moves NO money — it's a request. If
// you happen to control both the sending and receiving company (very
// common if you own multiple companies yourself), there's no one else to
// approve, so it completes immediately, exactly like the old behavior.
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
	var fromAccountType string
	err = tx.QueryRow(
		`SELECT current_balance, is_active, company_id, account_type FROM accounts WHERE id = $1 FOR UPDATE`,
		input.FromAccountID,
	).Scan(&fromBalance, &fromActive, &fromCompanyID, &fromAccountType)
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
	isSenderMember, err := utils.IsCompanyMember(fromCompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isSenderMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "from_account not found"})
		return
	}

	if !fromActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "from_account is not active"})
		return
	}

	// Confirm the destination account exists and is active, and find out
	// which company it belongs to. Deliberately NO membership requirement
	// on the destination itself — same as sending money to someone else's
	// real bank account — but we DO need to know whether the requester
	// ALSO happens to control it, to decide if this needs approval at all.
	var toActive bool
	var toCompanyID string
	var toAccountType string
	err = tx.QueryRow(
		`SELECT is_active, company_id, account_type FROM accounts WHERE id = $1 FOR UPDATE`,
		input.ToAccountID,
	).Scan(&toActive, &toCompanyID, &toAccountType)
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

	isReceiverMember, err := utils.IsCompanyMember(toCompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	isBothSides := isSenderMember && isReceiverMember

	status := "PENDING"
	if isBothSides {
		// No one else to wait on — same shortcut the old single-party
		// version always took. Balance still has to be checked NOW,
		// because we're about to move it now.
		if fromBalance < input.Amount {
			c.JSON(http.StatusBadRequest, gin.H{"error": "insufficient balance in from_account"})
			return
		}
		if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2`, input.Amount, input.FromAccountID); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2`, input.Amount, input.ToAccountID); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		status = "COMPLETED"
	}
	// When NOT both sides: deliberately no balance check here at all. The
	// authoritative check happens in RespondToTransfer at the moment the
	// receiving company actually approves it — the balance can legitimately
	// change between "request sent" and "request approved".

	// Record the transfer under the SOURCE account's real company —
	// derived above, never the client's word for it. transfer_type is
	// derived too, from the two accounts' real types — the user never
	// picks it, and it can never end up mismatched from what actually
	// happened.
	transferType := deriveTransferType(fromAccountType, toAccountType)

	var transfer models.Transfer
	insertQuery := `
		INSERT INTO transfers (
			company_id, transfer_type, from_account_id, to_account_id,
			amount, status, transfer_notes, created_by_user, updated_by_user
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
		RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at`

	err = tx.QueryRow(insertQuery,
		fromCompanyID, transferType, input.FromAccountID, input.ToAccountID,
		input.Amount, status, input.TransferNotes, input.CreatedByUser,
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

// deriveTransferType infers the transfer_type enum value purely from the
// two accounts' real types — BANK or CASH on each side. The user never
// picks this manually, and since it's derived from the same account rows
// the balances actually move against, it can never mismatch reality the
// way a free-choice dropdown could.
func deriveTransferType(fromType, toType string) string {
	switch {
	case fromType == "BANK" && toType == "BANK":
		return "BANK TO BANK TRANSFER"
	case fromType == "CASH" && toType == "BANK":
		return "CASH DEPOSIT IN BANK"
	case fromType == "BANK" && toType == "CASH":
		return "CASH WITHDRAWAL FROM BANK"
	default: // CASH -> CASH
		return "CASH ACCOUNT TRANSFER"
	}
}

// transferListSelect is the shared SELECT used by GetTransfers and
// GetTransferByID — kept in one place so the two never drift apart on
// which columns/joins they return.
const transferListSelect = `
	SELECT t.id, t.company_id, t.transfer_type, t.transaction_date, t.from_account_id, t.to_account_id,
	       t.amount, t.status, t.transfer_notes, t.created_by_user, t.updated_by_user, t.created_at, t.updated_at,
	       t.pending_status, t.proposed_by_company_id, t.proposed_by_user_id,
	       fc.company_name, tc.company_name, fa.account_type, ta.account_type, cu.name, uu.name, pu.name
	FROM transfers t
	JOIN accounts fa ON fa.id = t.from_account_id
	JOIN company fc ON fc.id = fa.company_id
	JOIN accounts ta ON ta.id = t.to_account_id
	JOIN company tc ON tc.id = ta.company_id
	JOIN users cu ON cu.id = t.created_by_user
	JOIN users uu ON uu.id = t.updated_by_user
	LEFT JOIN users pu ON pu.id = t.proposed_by_user_id`

func scanTransferRow(row interface{ Scan(...interface{}) error }) (models.Transfer, error) {
	var t models.Transfer
	var proposedByName sql.NullString
	err := row.Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
		&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
		&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt,
		&t.PendingStatus, &t.ProposedByCompanyID, &t.ProposedByUserID,
		&t.FromCompanyName, &t.ToCompanyName, &t.FromAccountType, &t.ToAccountType,
		&t.CreatedByName, &t.UpdatedByName, &proposedByName)
	if err == nil {
		t.ProposedByName = utils.NullStringOrEmpty(proposedByName)
	}
	return t, err
}

// GetTransfers handles GET /transfers
// company_id is required — without it there'd be no way to scope results
// to companies the requester actually belongs to. account_id and status
// remain optional additional filters.
//
// Matches a transfer if the queried company is EITHER the sender's or the
// receiver's — this is what makes a cross-company/external transfer show
// up in both companies' transfer histories, not just the sender's.
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

	query := transferListSelect + `
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
		t, err := scanTransferRow(rows)
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
		transfers = append(transfers, t)
	}

	c.JSON(http.StatusOK, transfers)
}

// GetTransferByID handles GET /transfers/:id
// Viewable by a member of EITHER the sending or receiving company — same
// "either side" logic as GetTransfers above.
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

	row := config.DB.QueryRow(transferListSelect+` WHERE t.id = $1`, id)
	t, err := scanTransferRow(row)
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

// ProposeTransferStatus handles PATCH /transfers/:id/propose
//
// The only thing this ever proposes is reversing an already-COMPLETED
// transfer. It never applies anything by itself — UNLESS the requester
// happens to control both companies involved, in which case there's no one
// else to ask and it applies immediately (mirroring the same shortcut
// CreateTransfer takes).
func ProposeTransferStatus(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	var input models.ProposeStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	tx, err := config.DB.Begin()
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer tx.Rollback()

	var currentStatus string
	var pendingStatus sql.NullString
	var fromAccountID, toAccountID string
	var amount float64
	err = tx.QueryRow(
		`SELECT status, pending_status, from_account_id, to_account_id, amount FROM transfers WHERE id = $1 FOR UPDATE`,
		id,
	).Scan(&currentStatus, &pendingStatus, &fromAccountID, &toAccountID, &amount)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if currentStatus != "COMPLETED" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only a completed transfer can be proposed for reversal"})
		return
	}
	if pendingStatus.Valid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "there is already a proposal awaiting a decision on this transfer"})
		return
	}

	var t models.Transfer

	if isSenderMember && isReceiverMember {
		// No one else to wait on — reverse it right now.
		if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2`, amount, fromAccountID); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2`, amount, toAccountID); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		row := tx.QueryRow(`
			UPDATE transfers SET status = 'REVERSED', updated_by_user = $1
			WHERE id = $2
			RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
			          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at,
			          pending_status, proposed_by_company_id, proposed_by_user_id`,
			input.UpdatedByUser, id)
		t, err = scanBareTransferRow(row)
	} else {
		proposerCompanyID := fromCompanyID
		if isReceiverMember {
			proposerCompanyID = toCompanyID
		}
		row := tx.QueryRow(`
			UPDATE transfers
			SET pending_status = $1, proposed_by_company_id = $2, proposed_by_user_id = $3, updated_by_user = $3
			WHERE id = $4
			RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
			          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at,
			          pending_status, proposed_by_company_id, proposed_by_user_id`,
			input.Status, proposerCompanyID, input.UpdatedByUser, id)
		t, err = scanBareTransferRow(row)
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, t)
}

// scanBareTransferRow scans the columns returned by an UPDATE ... RETURNING
// in this file — no joined display fields, just the real columns. Used
// inside a transaction where we don't want to run the full join query again.
func scanBareTransferRow(row *sql.Row) (models.Transfer, error) {
	var t models.Transfer
	err := row.Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
		&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
		&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt,
		&t.PendingStatus, &t.ProposedByCompanyID, &t.ProposedByUserID)
	return t, err
}

// RespondToTransfer handles PATCH /transfers/:id/approval
//
// This is the ONLY place a transfer's status changes as a result of a
// balance actually moving (other than the "both sides are the same person"
// shortcuts in CreateTransfer/ProposeTransferStatus). It answers whichever
// of the two things can currently be awaiting a decision:
//
//  1. A brand-new PENDING transfer — only the RECEIVING company may
//     approve it (which completes it and moves the money for the first
//     time); either side may reject it (CANCELLED, nothing ever moved).
//
//  2. A pending REVERSED proposal on a COMPLETED transfer — only the side
//     that did NOT propose it may respond. Approving moves the balances
//     back and sets REVERSED; rejecting clears the proposal and leaves the
//     transfer exactly as it was (COMPLETED).
func RespondToTransfer(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	var input models.ApprovalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	tx, err := config.DB.Begin()
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer tx.Rollback()

	var currentStatus string
	var pendingStatus, proposedByCompanyID sql.NullString
	var fromAccountID, toAccountID string
	var amount float64
	err = tx.QueryRow(
		`SELECT status, pending_status, proposed_by_company_id, from_account_id, to_account_id, amount
		 FROM transfers WHERE id = $1 FOR UPDATE`,
		id,
	).Scan(&currentStatus, &pendingStatus, &proposedByCompanyID, &fromAccountID, &toAccountID, &amount)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "transfer not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	var newStatus string

	switch {
	case currentStatus == "PENDING":
		if input.Approve {
			if !isReceiverMember {
				c.JSON(http.StatusForbidden, gin.H{"error": "only the receiving company can approve a pending transfer"})
				return
			}
			// Authoritative balance check — the only one that matters,
			// since time has passed since the request was created.
			var fromBalance float64
			var fromActive bool
			if err = tx.QueryRow(`SELECT current_balance, is_active FROM accounts WHERE id = $1 FOR UPDATE`, fromAccountID).
				Scan(&fromBalance, &fromActive); err != nil {
				utils.RespondDBError(c, err)
				return
			}
			if !fromActive {
				c.JSON(http.StatusBadRequest, gin.H{"error": "the sending account is no longer active"})
				return
			}
			if fromBalance < amount {
				c.JSON(http.StatusBadRequest, gin.H{"error": "the sending account no longer has sufficient balance"})
				return
			}
			if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2`, amount, fromAccountID); err != nil {
				utils.RespondDBError(c, err)
				return
			}
			if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2`, amount, toAccountID); err != nil {
				utils.RespondDBError(c, err)
				return
			}
			newStatus = "COMPLETED"
		} else {
			// Either side may retract/reject a still-pending request —
			// nothing has moved yet, so there's nothing to undo.
			newStatus = "CANCELLED"
		}

	case currentStatus == "COMPLETED" && pendingStatus.Valid:
		requesterCompanyID := fromCompanyID
		if isReceiverMember {
			requesterCompanyID = toCompanyID
		}
		if proposedByCompanyID.Valid && proposedByCompanyID.String == requesterCompanyID {
			c.JSON(http.StatusForbidden, gin.H{"error": "you already proposed this change — waiting on the other company to respond"})
			return
		}
		if input.Approve {
			// Only REVERSED is ever proposed today — move the balances back.
			if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance + $1 WHERE id = $2`, amount, fromAccountID); err != nil {
				utils.RespondDBError(c, err)
				return
			}
			if _, err = tx.Exec(`UPDATE accounts SET current_balance = current_balance - $1 WHERE id = $2`, amount, toAccountID); err != nil {
				utils.RespondDBError(c, err)
				return
			}
			newStatus = pendingStatus.String
		} else {
			// Rejected — stays exactly as it was, just clear the proposal.
			newStatus = currentStatus
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "there is nothing awaiting approval on this transfer"})
		return
	}

	row := tx.QueryRow(`
		UPDATE transfers
		SET status = $1, pending_status = NULL, proposed_by_company_id = NULL, proposed_by_user_id = NULL, updated_by_user = $2
		WHERE id = $3
		RETURNING id, company_id, transfer_type, transaction_date, from_account_id, to_account_id,
		          amount, status, transfer_notes, created_by_user, updated_by_user, created_at, updated_at,
		          pending_status, proposed_by_company_id, proposed_by_user_id`,
		newStatus, input.UpdatedByUser, id)
	t, err := scanBareTransferRow(row)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, t)
}
