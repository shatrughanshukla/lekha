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
// trusted from the client. See transfer_handler.go for why.
type CreateTransferInput struct {
	TransferType  string  `json:"transfer_type" binding:"required,oneof='CASH DEPOSIT IN BANK' 'CASH WITHDRAWAL FROM BANK' 'BANK TO BANK TRANSFER' 'CASH ACCOUNT TRANSFER'"`
	FromAccountID string  `json:"from_account_id" binding:"required,uuid"`
	ToAccountID   string  `json:"to_account_id" binding:"required,uuid,nefield=FromAccountID"`
	Amount        float64 `json:"amount" binding:"required,gt=0"`
	TransferNotes *string `json:"transfer_notes"`
	CreatedByUser string  `json:"created_by_user" binding:"required,uuid"`
}

// UpdateTransferStatusInput is the payload accepted by PATCH /transfers/:id/status.
// Status is the only field that should change after a transfer is created.
type UpdateTransferStatusInput struct {
	Status        string `json:"status" binding:"required,oneof=PENDING PROCESSING COMPLETED FAILED CANCELLED REVERSED"`
	UpdatedByUser string `json:"updated_by_user" binding:"required,uuid"`
}
