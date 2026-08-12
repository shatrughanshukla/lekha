package models

// TransferSummary is a company's transfer activity, computed entirely with
// plain SQL — no AI involved. This is the single source of truth for every
// number the insights endpoint later hands to an LLM to phrase into a
// paragraph; the LLM never calculates anything itself.
type TransferSummary struct {
	CompanyID       string         `json:"company_id"`
	TotalTransfers  int            `json:"total_transfers"`
	TotalAmount     float64        `json:"total_amount"`
	CountByStatus   map[string]int `json:"count_by_status"`
	CountByType     map[string]int `json:"count_by_type"`
	LargestTransfer float64        `json:"largest_transfer"`
}

// CompanyInsightsResponse wraps the numeric summary together with the
// AI-generated plain-English paragraph describing it, so a client can show
// both — the numbers a user can verify, and the sentence that explains them.
type CompanyInsightsResponse struct {
	Summary TransferSummary `json:"summary"`
	Insight string          `json:"insight"`
}
