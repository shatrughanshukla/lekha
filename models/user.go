package models

import "time"

// User mirrors the `users` table.
type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // never serialize the hash back to clients
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UpdateUserInput is the payload accepted by PUT /users/:id.
// Pointers let us tell "field omitted" apart from "field set to empty".
type UpdateUserInput struct {
	Name  *string `json:"name"`
	Email *string `json:"email"`
}
