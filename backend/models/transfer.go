package models

import "time"

// Transfer mirrors the `transfers` table. The fields below the blank line
// are NOT real columns — they're joined in by GetTransfers/GetTransferByID/
// SearchTransfers so a client can show "which company, which account, who"
// without extra round trips. They're empty on Create/Update responses.
type Transfer struct {
	ID              string    `json:"id"`
	CompanyID       string    `json:"company_id"`
	TransferType    string    `json:"transfer_type"`
	TransactionDate time.Time `json:"transaction_date"`
	FromAccountID   string    `json:"from_account_id"`
	ToAccountID     string    `json:"to_account_id"`
	Amount          float64   `json:"amount"`
	Status          string    `json:"status"`
	TransferNotes   *string   `json:"transfer_notes"`
	CreatedByUser   string    `json:"created_by_user"`
	UpdatedByUser   string    `json:"updated_by_user"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	// Two-party approval workflow. A transfer's displayed Status only ever
	// changes as the result of BOTH sides agreeing — see transfer_handler.go
	// for the full state machine. PendingStatus is non-nil exactly when one
	// side has proposed changing an already-COMPLETED transfer (currently
	// only to REVERSED) and the other side hasn't responded yet; the
	// balances have NOT moved for that proposal until it's approved.
	PendingStatus       *string `json:"pending_status"`
	ProposedByCompanyID *string `json:"proposed_by_company_id"`
	ProposedByUserID    *string `json:"proposed_by_user_id"`
	ProposedByName      string  `json:"proposed_by_name,omitempty"`

	FromCompanyName string `json:"from_company_name,omitempty"`
	ToCompanyName   string `json:"to_company_name,omitempty"`
	FromAccountType string `json:"from_account_type,omitempty"`
	ToAccountType   string `json:"to_account_type,omitempty"`
	CreatedByName   string `json:"created_by_name,omitempty"`
	UpdatedByName   string `json:"updated_by_name,omitempty"`
}

// CreateTransferInput is the payload accepted by POST /transfers.
// There is deliberately no company_id field — the transfer's company is
// derived server-side from from_account_id's real owning company, never
// trusted from the client. There's also no transfer_type field — it's
// derived from the two accounts' real types (see deriveTransferType in
// transfer_handler.go), so the user never has to pick it and it can never
// end up mismatched from what the accounts actually are.
type CreateTransferInput struct {
	FromAccountID string  `json:"from_account_id" binding:"required,uuid"`
	ToAccountID   string  `json:"to_account_id" binding:"required,uuid,nefield=FromAccountID"`
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	TransferNotes *string `json:"transfer_notes"`
	CreatedByUser string  `json:"created_by_user" binding:"required,uuid"`
}

// ProposeStatusInput is the payload accepted by PATCH /transfers/:id/propose.
// Only usable on an already-COMPLETED transfer with no proposal already in
// flight — it starts a proposal, it never applies anything by itself.
type ProposeStatusInput struct {
	Status        string `json:"status" binding:"required,oneof=REVERSED"`
	UpdatedByUser string `json:"updated_by_user" binding:"required,uuid"`
}

// ApprovalInput is the payload accepted by PATCH /transfers/:id/approval —
// the one place a transfer's status (and the money) actually moves.
// It answers whatever is currently awaiting a decision on this transfer:
// a brand-new PENDING transfer, or a pending REVERSED proposal.
type ApprovalInput struct {
	Approve       bool   `json:"approve"`
	UpdatedByUser string `json:"updated_by_user" binding:"required,uuid"`
}
