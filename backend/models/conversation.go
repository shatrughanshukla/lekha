package models

import "time"

// Conversation is one saved assistant chat thread, owned by exactly one
// user. Title starts as a short excerpt of the first message (see
// deriveConversationTitle in conversation_handler.go) — never "New
// conversation N".
type Conversation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConversationMessage is one turn within a Conversation. Only role+content
// are persisted — a proposed ChatAction is not stored (see
// conversation_handler.go for why: it's re-validated against live data on
// every turn, so a stale stored proposal would be misleading after a
// reload rather than useful).
type ConversationMessage struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	Role           string    `json:"role"` // "user" | "assistant"
	Content        string    `json:"content"`
	CreatedAt      time.Time `json:"created_at"`
}

// ConversationWithMessages is the response shape for
// GET /conversations/:id.
type ConversationWithMessages struct {
	Conversation
	Messages []ConversationMessage `json:"messages"`
}

// SendMessageRequest is the body for POST /conversations/messages.
// ConversationID is optional — an empty value creates a new conversation
// (lazy creation, so navigating to the Assistant never creates an empty
// row before the user actually sends anything).
type SendMessageRequest struct {
	ConversationID string `json:"conversation_id"`
	Message        string `json:"message" binding:"required"`
}

// SendMessageResponse mirrors ChatResponse but adds the (possibly newly
// created) conversation's id/title, so the frontend can update its
// history list from this one response instead of a second round trip.
type SendMessageResponse struct {
	ConversationID string      `json:"conversation_id"`
	Title          string      `json:"title"`
	Reply          string      `json:"reply"`
	Action         *ChatAction `json:"action,omitempty"`
}
