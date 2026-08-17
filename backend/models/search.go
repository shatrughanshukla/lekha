package models

// SearchTransfersInput is the payload accepted by POST /transfers/search.
// company_id is supplied by the client (the signed-in user's own company),
// never derived from the LLM — it scopes the search before the AI is even
// involved.
type SearchTransfersInput struct {
	CompanyID string `json:"company_id" binding:"required,uuid"`
	Query     string `json:"query" binding:"required"`
}

// ParsedSearchFilters is the structured shape the LLM is asked to produce
// from the user's sentence. It is never trusted directly — every field is
// re-validated against the same whitelists the rest of the API enforces
// before it's used in a query.
type ParsedSearchFilters struct {
	Status       string  `json:"status"`
	TransferType string  `json:"transfer_type"`
	MinAmount    float64 `json:"min_amount"`
	MaxAmount    float64 `json:"max_amount"`
	DateFrom     string  `json:"date_from"`
	DateTo       string  `json:"date_to"`
}
