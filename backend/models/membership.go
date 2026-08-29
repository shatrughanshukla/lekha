package models

import "time"

// CompanyMember mirrors the `company_members` table, joined with the user's
// name/email so a client doesn't have to make a second call to display who
// has access to a company.
type CompanyMember struct {
	UserID            string    `json:"user_id"`
	Name              string    `json:"name"`
	Email             string    `json:"email"`
	ProfilePictureURL *string   `json:"profile_picture_url"`
	IsAdmin           bool      `json:"is_admin"`
	CreatedAt         time.Time `json:"member_since"`
}

// AddMemberInput is the payload accepted by POST /companies/:id/members.
// A member is added by email (something a person actually knows) rather
// than by their raw user ID. Only an admin can call this.
type AddMemberInput struct {
	Email string `json:"email" binding:"required,email"`
}

// UpdateMemberRoleInput is the payload accepted by
// PATCH /companies/:id/members/:user_id. Only an admin can call this.
type UpdateMemberRoleInput struct {
	IsAdmin bool `json:"is_admin"`
}
