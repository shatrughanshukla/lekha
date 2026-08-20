package models

import "time"

// Account mirrors the `accounts` table. CompanyName is not a real column —
// it's joined in by the listing endpoints (GetAccounts, GetAccountByID) so
// a client picking between accounts across several companies (e.g. the
// transfer "from" picker) can show which company each one belongs to
// without a second round trip. It's empty on Create/Update responses.
type Account struct {
	ID             string    `json:"id"`
	CompanyID      string    `json:"company_id"`
	CompanyName    string    `json:"company_name,omitempty"`
	AccountType    string    `json:"account_type"`
	CurrentBalance float64   `json:"current_balance"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	CreatedBy      string    `json:"created_by"`
	UpdatedBy      string    `json:"updated_by"`
}

// CreateAccountInput is the payload accepted by POST /accounts.
type CreateAccountInput struct {
	CompanyID      string  `json:"company_id" binding:"required,uuid"`
	AccountType    string  `json:"account_type" binding:"required,oneof=BANK CASH"`
	CurrentBalance float64 `json:"current_balance" binding:"gte=0"`
	CreatedBy      string  `json:"created_by" binding:"required,uuid"`
}

// UpdateAccountInput is the payload accepted by PUT /accounts/:id.
// Only fields that make sense to edit directly are exposed here —
// balance changes should go through the transfers API, not this endpoint.
type UpdateAccountInput struct {
	AccountType *string `json:"account_type" binding:"omitempty,oneof=BANK CASH"`
	IsActive    *bool   `json:"is_active"`
	UpdatedBy   string  `json:"updated_by" binding:"required,uuid"`
}
