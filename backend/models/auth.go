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

// ChangePasswordInput is the payload accepted by PATCH /users/:id/password.
// Requires the current password so a hijacked session (or someone briefly
// at an unlocked device) can't silently lock the real owner out.
type ChangePasswordInput struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

// ForgotPasswordInput is the payload accepted by POST /auth/forgot-password.
type ForgotPasswordInput struct {
	Email string `json:"email" binding:"required,email"`
}

// ResetPasswordInput is the payload accepted by POST /auth/reset-password.
type ResetPasswordInput struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

// VerifyEmailInput is the payload accepted by POST /auth/verify-email.
type VerifyEmailInput struct {
	Token string `json:"token" binding:"required"`
}

// AuthResponse is returned by both signup and signin on success.
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
