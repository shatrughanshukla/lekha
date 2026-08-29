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

// CompanyActivity is one company's transfer activity as seen from the
// cross-company overview — the same numeric source as TransferSummary
// (buildTransferSummary), just the subset of it relevant when comparing
// many companies side by side rather than looking at one in detail.
type CompanyActivity struct {
	CompanyID      string  `json:"company_id"`
	CompanyName    string  `json:"company_name"`
	TotalTransfers int     `json:"total_transfers"`
	TotalAmount    float64 `json:"total_amount"`
}

// OverviewSummary is every company the current user belongs to, with each
// one's transfer activity — computed entirely with plain SQL. Same
// principle as TransferSummary: the LLM that later phrases this into a
// paragraph never calculates anything itself, only describes these numbers.
type OverviewSummary struct {
	TotalCompanies          int                `json:"total_companies"`
	CompaniesWithActivity   int                `json:"companies_with_activity"`
	TotalAmountAllCompanies float64            `json:"total_amount_all_companies"`
	Companies               []CompanyActivity  `json:"companies"`
}

// OverviewInsightsResponse wraps the numeric cross-company overview
// together with the AI-generated plain-English paragraph describing it.
type OverviewInsightsResponse struct {
	Summary OverviewSummary `json:"summary"`
	Insight string          `json:"insight"`
}
