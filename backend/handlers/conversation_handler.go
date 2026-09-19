package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// deriveConversationTitle makes a short, human title from the first user
// message instead of ever showing "New conversation 1234" (Phase 4.6).
// Deliberately not a second Gemini call — one extra AI round trip per new
// conversation just to name it isn't worth the latency/cost when a plain
// truncation already reads fine ("How much did I transfer this month?").
func deriveConversationTitle(message string) string {
	title := strings.TrimSpace(message)
	title = strings.ReplaceAll(title, "\n", " ")
	const maxLen = 60
	runes := []rune(title)
	if len(runes) <= maxLen {
		if title == "" {
			return "New conversation"
		}
		return title
	}
	return strings.TrimSpace(string(runes[:maxLen])) + "…"
}

// conversationOwner returns the owning user_id for a conversation, or
// sql.ErrNoRows if it doesn't exist. Every handler below calls this first
// and compares it to the requester — mirroring the rest of the app's
// pattern of returning 404 (never 403) on a mismatch, so a guessed ID
// doesn't confirm to an outsider that it belongs to someone else.
func conversationOwner(id string) (string, error) {
	var ownerID string
	err := config.DB.QueryRow(`SELECT user_id FROM conversations WHERE id = $1`, id).Scan(&ownerID)
	return ownerID, err
}

// ListConversations handles GET /conversations
// Returns this user's own conversations only, most recently active first.
// No message bodies here — just enough for the history sidebar list.
func ListConversations(c *gin.Context) {
	userID := c.GetString("user_id")

	rows, err := config.DB.Query(`
		SELECT id, user_id, title, created_at, updated_at
		FROM conversations
		WHERE user_id = $1
		ORDER BY updated_at DESC`, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	conversations := []models.Conversation{}
	for rows.Next() {
		var conv models.Conversation
		if err := rows.Scan(&conv.ID, &conv.UserID, &conv.Title, &conv.CreatedAt, &conv.UpdatedAt); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		conversations = append(conversations, conv)
	}

	c.JSON(http.StatusOK, conversations)
}

// GetConversation handles GET /conversations/:id
// Returns the conversation plus every message in it, oldest first — ready
// to render top-to-bottom without the frontend re-sorting.
func GetConversation(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	userID := c.GetString("user_id")
	ownerID, err := conversationOwner(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "conversation_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if ownerID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "conversation_not_found")})
		return
	}

	var result models.ConversationWithMessages
	err = config.DB.QueryRow(`
		SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = $1`, id).
		Scan(&result.ID, &result.UserID, &result.Title, &result.CreatedAt, &result.UpdatedAt)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	rows, err := config.DB.Query(`
		SELECT id, conversation_id, role, content, created_at
		FROM messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC`, id)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	result.Messages = []models.ConversationMessage{}
	for rows.Next() {
		var m models.ConversationMessage
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		result.Messages = append(result.Messages, m)
	}

	c.JSON(http.StatusOK, result)
}

// DeleteConversation handles DELETE /conversations/:id
// Messages are removed by the FK's ON DELETE CASCADE (see the migration) —
// nothing extra to clean up here.
func DeleteConversation(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	userID := c.GetString("user_id")
	ownerID, err := conversationOwner(id)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "conversation_not_found")})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if ownerID != userID {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "conversation_not_found")})
		return
	}

	if _, err := config.DB.Exec(`DELETE FROM conversations WHERE id = $1`, id); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": utils.Msg(c, "conversation_deleted")})
}

// SendConversationMessage handles POST /conversations/messages
//
// This is the persisted counterpart to ChatWithAssistant (POST /chat).
// If ConversationID is empty, a new conversation is created first (lazy
// creation — Phase 4.5: opening the Assistant never creates a row until
// the user actually sends something). Either way: load prior messages as
// history, run the exact same assistant turn ChatWithAssistant uses, then
// persist both the user's message and the assistant's reply.
//
// Only role+content is stored for the assistant's turn — a proposed
// ChatAction is NOT persisted. Actions are re-validated against the
// user's live accounts/pending transfers every time (see actionIsValid in
// chat_handler.go); replaying a stored action after a reload could offer
// to confirm something that's no longer accurate (the account might be
// gone, the transfer might already be resolved). Re-asking the assistant
// gets a fresh, correctly validated proposal instead.
func SendConversationMessage(c *gin.Context) {
	var input models.SendMessageRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	userID := c.GetString("user_id")
	lang := utils.LangFromContext(c)

	conversationID := input.ConversationID
	title := ""

	if conversationID != "" {
		if !utils.IsValidUUID(conversationID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
			return
		}
		ownerID, err := conversationOwner(conversationID)
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "conversation_not_found")})
			return
		}
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
		if ownerID != userID {
			c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "conversation_not_found")})
			return
		}
	} else {
		title = deriveConversationTitle(input.Message)
		err := config.DB.QueryRow(`
			INSERT INTO conversations (user_id, title) VALUES ($1, $2)
			RETURNING id`, userID, title).Scan(&conversationID)
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
	}

	// Prior turns, oldest first, in the shape runAssistantTurn (and the
	// Gemini prompt it builds) already expects.
	rows, err := config.DB.Query(`
		SELECT role, content FROM messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC`, conversationID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	history := []models.ChatMessage{}
	for rows.Next() {
		var m models.ChatMessage
		if err := rows.Scan(&m.Role, &m.Content); err != nil {
			rows.Close()
			utils.RespondDBError(c, err)
			return
		}
		history = append(history, m)
	}
	rows.Close()

	resp, err := runAssistantTurn(userID, lang, history, input.Message)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if _, err := config.DB.Exec(
		`INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
		conversationID, input.Message,
	); err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if _, err := config.DB.Exec(
		`INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
		conversationID, resp.Reply,
	); err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if _, err := config.DB.Exec(
		`UPDATE conversations SET updated_at = now() WHERE id = $1`, conversationID,
	); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if title == "" {
		// Existing conversation — the frontend already has the title;
		// leave it as-is rather than re-querying just to echo it back.
		_ = config.DB.QueryRow(`SELECT title FROM conversations WHERE id = $1`, conversationID).Scan(&title)
	}

	c.JSON(http.StatusOK, models.SendMessageResponse{
		ConversationID: conversationID,
		Title:          title,
		Reply:          resp.Reply,
		Action:         resp.Action,
	})
}
