package models

import "time"

// CompanyMember mirrors the `company_members` table, joined with the user's
// name/email so a client doesn't have to make a second call to display who
// has access to a company.
type CompanyMember struct {
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"member_since"`
}

// AddMemberInput is the payload accepted by POST /companies/:id/members.
// A member is added by email (something a person actually knows) rather
// than by their raw user ID.
type AddMemberInput struct {
	Email string `json:"email" binding:"required,email"`
}
