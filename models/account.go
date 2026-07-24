package models

import "time"

type Account struct {
	ID             string    `json:"id"`
	CompanyID      string    `json:"company_id"`
	AccountType    string    `json:"account_type"`
	CurrentBalance float64   `json:"current_balance"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	CreatedBy      string    `json:"created_by"`
	UpdatedBy      string    `json:"updated_by"`
}

type CreateAccountInput struct {
	CompanyID      string  `json:"company_id" binding:"required,uuid"`
	AccountType    string  `json:"account_type" binding:"required,oneof=SAVINGS CURRENT CASH OVERDRAFT"`
	CurrentBalance float64 `json:"current_balance" binding:"gte=0"`
	CreatedBy      string  `json:"created_by" binding:"required,uuid"`
}

type UpdateAccountInput struct {
	AccountType *string `json:"account_type" binding:"omitempty,oneof=SAVINGS CURRENT CASH OVERDRAFT"`
	IsActive    *bool   `json:"is_active"`
	UpdatedBy   string  `json:"updated_by" binding:"required,uuid"`
}