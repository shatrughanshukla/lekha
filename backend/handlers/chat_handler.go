package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

type chatAccountContext struct {
	ID          string  `json:"id"`
	CompanyName string  `json:"company_name"`
	AccountType string  `json:"account_type"`
	Balance     float64 `json:"balance"`
}

type chatPendingTransferContext struct {
	ID            string  `json:"id"`
	Amount        float64 `json:"amount"`
	Status        string  `json:"status"`
	PendingStatus *string `json:"pending_status,omitempty"`
	FromCompany   string  `json:"from_company"`
	ToCompany     string  `json:"to_company"`
}

// buildChatContext gathers everything the assistant is allowed to see and
// reason about for this user: their aggregate transfer stats (reusing the
// same numbers the Reports page shows), their own active accounts, and any
// transfers currently awaiting an approval decision. Nothing here is
// invented — it's the same data the rest of the app already exposes to
// this user, just packaged for the model in one place.
func buildChatContext(userID string) (map[string]interface{}, []chatAccountContext, []chatPendingTransferContext, error) {
	// nil, nil = all time, preserving exactly the report the Assistant saw
	// before Phase 5 added optional date-range filtering to this function
	// for the Reports page — the Assistant itself is out of this phase's
	// scope and its context shouldn't narrow without being asked.
	report, err := buildGlobalReport(userID, nil, nil)
	if err != nil {
		return nil, nil, nil, err
	}

	accountRows, err := config.DB.Query(`
		SELECT a.id, co.company_name, a.account_type, a.current_balance
		FROM accounts a
		JOIN company_members cm ON cm.company_id = a.company_id
		JOIN company co ON co.id = a.company_id
		WHERE cm.user_id = $1 AND a.is_active = true
		ORDER BY co.company_name, a.account_type`, userID)
	if err != nil {
		return nil, nil, nil, err
	}
	defer accountRows.Close()
	accounts := []chatAccountContext{}
	for accountRows.Next() {
		var a chatAccountContext
		if err := accountRows.Scan(&a.ID, &a.CompanyName, &a.AccountType, &a.Balance); err != nil {
			return nil, nil, nil, err
		}
		accounts = append(accounts, a)
	}

	pendingRows, err := config.DB.Query(`
		WITH my_companies AS (
			SELECT co.id FROM company co
			JOIN company_members cm ON cm.company_id = co.id
			WHERE cm.user_id = $1
		)
		SELECT DISTINCT t.id, t.amount, t.status, t.pending_status, fc.company_name, tc.company_name
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN company fc ON fc.id = fa.company_id
		JOIN accounts ta ON ta.id = t.to_account_id
		JOIN company tc ON tc.id = ta.company_id
		WHERE (fa.company_id IN (SELECT id FROM my_companies) OR ta.company_id IN (SELECT id FROM my_companies))
		  AND (t.status = 'PENDING' OR t.pending_status IS NOT NULL)`, userID)
	if err != nil {
		return nil, nil, nil, err
	}
	defer pendingRows.Close()
	pending := []chatPendingTransferContext{}
	for pendingRows.Next() {
		var p chatPendingTransferContext
		var pendingStatus sql.NullString
		if err := pendingRows.Scan(&p.ID, &p.Amount, &p.Status, &pendingStatus, &p.FromCompany, &p.ToCompany); err != nil {
			return nil, nil, nil, err
		}
		p.PendingStatus = utils.NullStringToPtr(pendingStatus)
		pending = append(pending, p)
	}

	context := map[string]interface{}{
		"report_summary":    report,
		"accounts":          accounts,
		"pending_transfers": pending,
	}
	return context, accounts, pending, nil
}

const chatSystemPromptEN = `You are Lekha's financial assistant chatbot, embedded in a ledger app. You are given real JSON context: report_summary (aggregate transfer stats), accounts (the user's own active bank/cash accounts with real balances), and pending_transfers (transfers currently awaiting an approval decision). All amounts are in Indian Rupees (₹).

Respond to ONLY the user's latest message, using the conversation history for context. Respond with a single JSON object in exactly this shape:
{"reply": "<your natural-language response to show the user>", "action": null}

If the user is asking a question, answer it using ONLY the numbers in the given context — never invent, estimate, or guess a number. If the context doesn't contain enough information to answer, say so honestly in "reply" and set "action" to null.

If the user clearly wants to SEND MONEY (create a transfer), and you can confidently match their described accounts to real entries in the "accounts" list by company name and account type, set "action" to:
{"type": "create_transfer", "from_account_id": "<id>", "to_account_id": "<id>", "amount": <number>, "notes": "<optional note, or empty string>", "confirm_label": "<short human summary like 'Send ₹5,000 from Blue Matters (Bank) to Phonepe (Bank)'>"}
and set "reply" to something like "Here's what I'll send — please confirm below." Do NOT guess if the match is ambiguous, if an account isn't in the "accounts" list, or if the amount is unclear — instead ask a clarifying question in "reply" and set "action" to null. Note: from_account_id must belong to the user (it will always be one of the ids in "accounts"), but to_account_id can be any account elsewhere — if the user names a destination not in "accounts", you may still propose it only if they gave you a literal account ID; otherwise ask them to paste the destination account ID.

If the user wants to APPROVE or REJECT a pending transfer, and you can confidently match it to one entry in "pending_transfers" (by amount, company names, or explicit mention), set "action" to:
{"type": "approve_transfer" or "reject_transfer", "transfer_id": "<id>", "confirm_label": "<short human summary like 'Approve the ₹10,000 transfer from Sakshi Infrastructure'>"}
Otherwise ask a clarifying question instead of guessing which one they mean.

NEVER include an "action" for anything except these three exact cases, and NEVER claim you have already performed an action — you only ever propose it for the user to confirm themselves. Keep "reply" concise and conversational.`

const chatSystemPromptHI = `आप Lekha ऐप में एक वित्तीय सहायक चैटबॉट हैं। आपको वास्तविक JSON संदर्भ दिया गया है: report_summary (कुल ट्रांसफर आंकड़े), accounts (उपयोगकर्ता के अपने सक्रिय बैंक/नकद खाते असली बैलेंस के साथ), और pending_transfers (स्वीकृति की प्रतीक्षा कर रहे ट्रांसफर)। सभी राशियां भारतीय रुपयों (₹) में हैं।

केवल उपयोगकर्ता के नवीनतम संदेश का उत्तर दें, बातचीत के इतिहास का उपयोग संदर्भ के लिए करें। बिल्कुल इसी आकार में एक JSON ऑब्जेक्ट के साथ उत्तर दें:
{"reply": "<उपयोगकर्ता को दिखाने के लिए आपका उत्तर>", "action": null}

यदि उपयोगकर्ता प्रश्न पूछ रहा है, तो केवल दिए गए संदर्भ की संख्याओं का उपयोग करके उत्तर दें — कभी भी कोई संख्या न गढ़ें, अनुमान न लगाएं। यदि जानकारी अपर्याप्त है, तो "reply" में ईमानदारी से बताएं और "action" को null रखें।

यदि उपयोगकर्ता स्पष्ट रूप से पैसा भेजना चाहता है और आप उनके बताए गए खातों को "accounts" सूची से आत्मविश्वास से मिला सकते हैं, तो "action" सेट करें:
{"type": "create_transfer", "from_account_id": "<id>", "to_account_id": "<id>", "amount": <संख्या>, "notes": "<वैकल्पिक नोट या खाली>", "confirm_label": "<संक्षिप्त सारांश>"}
अस्पष्ट होने पर कभी अनुमान न लगाएं — "reply" में स्पष्टीकरण मांगें और "action" को null रखें।

यदि उपयोगकर्ता किसी लंबित ट्रांसफर को स्वीकृत/अस्वीकृत करना चाहता है और आप उसे "pending_transfers" से आत्मविश्वास से मिला सकते हैं, तो "action" सेट करें:
{"type": "approve_transfer" या "reject_transfer", "transfer_id": "<id>", "confirm_label": "<संक्षिप्त सारांश>"}
अन्यथा स्पष्टीकरण मांगें।

इन तीन मामलों के अलावा कभी "action" शामिल न करें, और कभी दावा न करें कि आपने पहले ही कोई कार्रवाई कर दी है — आप केवल प्रस्ताव देते हैं। "reply" को संक्षिप्त और बातचीत जैसा रखें। पूरा जवाब हिंदी में लिखें।`

// ChatWithAssistant handles POST /chat.
//
// Safety model: the assistant is READ-ONLY by construction. It can only
// ever propose an action; it never calls any money-moving code itself.
// Any proposed action is also re-validated here against the user's real
// context before being returned, so even a confused model response can't
// reference an account/transfer that isn't genuinely the user's to act
// on. Actually executing an action is a separate, explicit request the
// frontend only sends after the user taps Confirm, using the exact same
// endpoints (and therefore the exact same authorization) as the rest of
// the app — this file never moves money itself.
//
// This endpoint itself stores nothing — it's the original stateless
// shape, kept as-is for anything still calling it directly. Persisted,
// multi-turn conversations (Phase 4) are handled by
// conversation_handler.go, which calls runAssistantTurn below with
// history loaded from the database instead of from the request body.
func ChatWithAssistant(c *gin.Context) {
	var input models.ChatRequest
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	userID := c.GetString("user_id")
	lang := utils.LangFromContext(c)

	resp, err := runAssistantTurn(userID, lang, input.History, input.Message)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

// runAssistantTurn is the actual "ask Gemini, validate the answer" core,
// shared by ChatWithAssistant (stateless, history from the request) and
// SendConversationMessage in conversation_handler.go (persisted, history
// loaded from the messages table). Keeping this in one place means the
// prompt, the context sent to the model, and the action-validation rules
// can never drift between the two call paths.
func runAssistantTurn(userID string, lang utils.Lang, history []models.ChatMessage, message string) (models.ChatResponse, error) {
	context, accounts, pending, err := buildChatContext(userID)
	if err != nil {
		return models.ChatResponse{}, err
	}
	contextJSON, err := json.Marshal(context)
	if err != nil {
		return models.ChatResponse{Reply: utils.MsgForLang(lang, "summary_prep_failed")}, nil
	}

	var convo strings.Builder
	for _, m := range history {
		convo.WriteString(m.Role)
		convo.WriteString(": ")
		convo.WriteString(m.Content)
		convo.WriteString("\n")
	}
	convo.WriteString("user: ")
	convo.WriteString(message)

	prompt := chatSystemPromptEN
	if lang == utils.LangHI {
		prompt = chatSystemPromptHI
	}
	userMessage := "CONTEXT:\n" + string(contextJSON) + "\n\nCONVERSATION:\n" + convo.String()

	raw, err := utils.CallGeminiJSON(prompt, userMessage)
	if err != nil {
		return models.ChatResponse{Reply: utils.MsgForLang(lang, "ai_summary_unavailable") + err.Error()}, nil
	}

	var resp models.ChatResponse
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &resp); err != nil {
		resp = models.ChatResponse{Reply: raw}
	}

	if resp.Action != nil && !actionIsValid(resp.Action, accounts, pending) {
		resp.Action = nil
	}

	return resp, nil
}

func actionIsValid(action *models.ChatAction, accounts []chatAccountContext, pending []chatPendingTransferContext) bool {
	switch action.Type {
	case "create_transfer":
		if action.ToAccountID == "" || action.Amount <= 0 {
			return false
		}
		for _, a := range accounts {
			if a.ID == action.FromAccountID {
				return true
			}
		}
		return false
	case "approve_transfer", "reject_transfer":
		for _, p := range pending {
			if p.ID == action.TransferID {
				return true
			}
		}
		return false
	default:
		return false
	}
}
