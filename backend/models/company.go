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

	// Not a column: whether the signed-in requester is an admin of this
	// company. Only filled in by GET /companies, so the UI knows whether to
	// offer rename/delete without an extra request per company.
	IsAdmin bool `json:"is_admin"`
}

// CreateCompanyInput is the payload accepted by POST /companies.
type CreateCompanyInput struct {
	CompanyName string `json:"company_name" binding:"required"`
	CreatedBy   string `json:"created_by" binding:"required,uuid"`
}

// UpdateCompanyInput is the payload accepted by PUT /companies/:id.
// updated_by is no longer accepted from the client: the audit field is taken
// from the authenticated user. The caller's password is required.
type UpdateCompanyInput struct {
	CompanyName string `json:"company_name" binding:"required"`
	Password    string `json:"password"`
}

// DeleteCompanyInput is the body of DELETE /companies/:id.
type DeleteCompanyInput struct {
	Password string `json:"password"`
}
