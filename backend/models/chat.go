package models

// ChatMessage is one turn of prior conversation, sent by the frontend so
// the assistant has context across a session (this backend is stateless —
// no conversation is stored server-side).
type ChatMessage struct {
	Role    string `json:"role"` // "user" | "assistant"
	Content string `json:"content"`
}

// ChatRequest is the payload for POST /chat.
type ChatRequest struct {
	Message string        `json:"message" binding:"required"`
	History []ChatMessage `json:"history"`
}

// ChatAction is a proposed money-moving action the assistant wants the
// user to explicitly confirm. The assistant NEVER executes this itself —
// the frontend only calls the real transfer endpoints after the user taps
// Confirm, going through exactly the same authorization path as the
// normal UI. This struct is just a suggestion, validated server-side
// against the user's real accounts/transfers before it's ever shown.
type ChatAction struct {
	Type          string  `json:"type"` // "create_transfer" | "approve_transfer" | "reject_transfer"
	FromAccountID string  `json:"from_account_id,omitempty"`
	ToAccountID   string  `json:"to_account_id,omitempty"`
	Amount        float64 `json:"amount,omitempty"`
	Notes         string  `json:"notes,omitempty"`
	TransferID    string  `json:"transfer_id,omitempty"`
	ConfirmLabel  string  `json:"confirm_label,omitempty"`
}

// ChatResponse is the payload returned from POST /chat.
type ChatResponse struct {
	Reply  string      `json:"reply"`
	Action *ChatAction `json:"action,omitempty"`
}
