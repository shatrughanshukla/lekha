package models

import "time"

// Company mirrors the `company` table.
type Company struct {
	ID          string    `json:"id"`
	CompanyName string    `json:"company_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedBy   string    `json:"created_by"`
	UpdatedBy   string    `json:"updated_by"`
}

// CreateCompanyInput is the payload accepted by POST /companies.
type CreateCompanyInput struct {
	CompanyName string `json:"company_name" binding:"required"`
	CreatedBy   string `json:"created_by" binding:"required,uuid"`
}

// UpdateCompanyInput is the payload accepted by PUT /companies/:id.
type UpdateCompanyInput struct {
	CompanyName string `json:"company_name" binding:"required"`
	UpdatedBy   string `json:"updated_by" binding:"required,uuid"`
}
