package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// validSearchTransferTypes mirrors transfer_type_enum in Postgres exactly.
var validSearchTransferTypes = map[string]bool{
	"CASH DEPOSIT IN BANK":      true,
	"CASH WITHDRAWAL FROM BANK": true,
	"BANK TO BANK TRANSFER":     true,
	"CASH ACCOUNT TRANSFER":     true,
}

const searchSystemPrompt = `You convert a plain-English question about bank transfers into a JSON filter object. You are given ONLY the user's question — you have no access to any transfer data. Respond with ONLY a JSON object, no other text, no markdown code fences, matching exactly this shape:

{"status": "", "transfer_type": "", "min_amount": 0, "max_amount": 0, "date_from": "", "date_to": ""}

Rules:
- "status" must be exactly one of: PENDING, COMPLETED, CANCELLED, REVERSED — or "" if not mentioned.
- "transfer_type" must be exactly one of: "CASH DEPOSIT IN BANK", "CASH WITHDRAWAL FROM BANK", "BANK TO BANK TRANSFER", "CASH ACCOUNT TRANSFER" — or "" if not mentioned.
- "min_amount" / "max_amount" are plain numbers, 0 if not mentioned.
- "date_from" / "date_to" are ISO dates (YYYY-MM-DD), "" if not mentioned. You do not know today's date — only use dates the user explicitly states; never guess a relative range like "last month".
- Never include any field not shown above. Never include explanation text.`

// SearchTransfers handles POST /transfers/search
//
// This is the natural-language search feature. The LLM is given ONLY the
// user's own typed sentence — never any account or transfer data — and asked
// to translate it into a small structured filter object. That object is then
// strictly validated against the same whitelists the rest of the API uses,
// before it's used to build a plain parameterized SQL query. The LLM never
// touches the database and never sees anyone's financial data.
func SearchTransfers(c *gin.Context) {
	var input models.SearchTransfersInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(input.CompanyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	raw, err := utils.CallGemini(searchSystemPrompt, input.Query)
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "search assistant unavailable: " + err.Error()})
		return
	}

	// Defensive cleanup in case the model wraps its answer in a code fence
	// despite being told not to.
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var filters models.ParsedSearchFilters
	if err := json.Unmarshal([]byte(cleaned), &filters); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "search assistant returned an unexpected format"})
		return
	}

	// The model's output is never trusted directly — every field is
	// re-checked against the same whitelists the rest of the API enforces.
	// Anything that doesn't pass is silently dropped (treated as "no
	// filter") rather than causing the whole search to fail.
	if filters.Status != "" && !utils.IsValidTransferStatus(filters.Status) {
		filters.Status = ""
	}
	if filters.TransferType != "" && !validSearchTransferTypes[filters.TransferType] {
		filters.TransferType = ""
	}
	if filters.MinAmount < 0 {
		filters.MinAmount = 0
	}
	if filters.MaxAmount < 0 {
		filters.MaxAmount = 0
	}

	query := `
		SELECT t.id, t.company_id, t.transfer_type, t.transaction_date, t.from_account_id, t.to_account_id,
		       t.amount, t.status, t.transfer_notes, t.created_by_user, t.updated_by_user, t.created_at, t.updated_at
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN accounts ta ON ta.id = t.to_account_id
		WHERE (fa.company_id = $1::uuid OR ta.company_id = $1::uuid)
		  AND ($2 = '' OR t.status = $2::transfer_status_enum)
		  AND ($3 = '' OR t.transfer_type = $3::transfer_type_enum)
		  AND ($4 = 0 OR t.amount >= $4)
		  AND ($5 = 0 OR t.amount <= $5)
		  AND ($6 = '' OR t.transaction_date >= $6::date)
		  AND ($7 = '' OR t.transaction_date <= $7::date)
		ORDER BY t.created_at DESC`

	rows, err := config.DB.Query(query, input.CompanyID, filters.Status, filters.TransferType,
		filters.MinAmount, filters.MaxAmount, filters.DateFrom, filters.DateTo)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	transfers := []models.Transfer{}
	for rows.Next() {
		var t models.Transfer
		if err := rows.Scan(&t.ID, &t.CompanyID, &t.TransferType, &t.TransactionDate,
			&t.FromAccountID, &t.ToAccountID, &t.Amount, &t.Status, &t.TransferNotes,
			&t.CreatedByUser, &t.UpdatedByUser, &t.CreatedAt, &t.UpdatedAt); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		transfers = append(transfers, t)
	}

	c.JSON(http.StatusOK, gin.H{
		"interpreted_filters": filters,
		"results":             transfers,
	})
}
