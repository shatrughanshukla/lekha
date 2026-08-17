package models

// SignUpInput is the payload accepted by POST /api/v1/auth/signup.
type SignUpInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

// SignInInput is the payload accepted by POST /api/v1/auth/signin.
type SignInInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse is returned by both signup and signin on success.
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
