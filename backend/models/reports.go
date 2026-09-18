package models

// ReportTimeSeriesPoint is one point in a volume/value-over-time chart.
type ReportTimeSeriesPoint struct {
	Date   string  `json:"date"` // YYYY-MM-DD
	Count  int     `json:"count"`
	Amount float64 `json:"amount"`
}

// ReportTopEntry is one row in a "top companies" or "top accounts" list.
type ReportTopEntry struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	CompanyName string  `json:"company_name,omitempty"`
	Amount      float64 `json:"amount"`
	Count       int     `json:"count"`
}

// ReportData is the full numeric payload behind the Reports page — always
// computed in plain Go/SQL first; the AI narrative only ever describes
// these already-correct numbers, never calculates anything itself.
type ReportData struct {
	Scope          string                  `json:"scope"` // "global" or "company"
	CompanyID      *string                 `json:"company_id,omitempty"`
	CompanyName    *string                 `json:"company_name,omitempty"`
	TotalTransfers int                     `json:"total_transfers"`
	TotalAmount    float64                 `json:"total_amount"`
	CountByStatus  map[string]int          `json:"count_by_status"`
	AmountByStatus map[string]float64      `json:"amount_by_status"`
	CountByType    map[string]int          `json:"count_by_type"`
	AmountByType   map[string]float64      `json:"amount_by_type"`
	IncomingTotal  float64                 `json:"incoming_total"`
	OutgoingTotal  float64                 `json:"outgoing_total"`
	TimeSeries     []ReportTimeSeriesPoint `json:"time_series"`
	TopCompanies   []ReportTopEntry        `json:"top_companies,omitempty"`
	TopAccounts    []ReportTopEntry        `json:"top_accounts"`
}

// ReportsResponse is the payload for GET /reports.
type ReportsResponse struct {
	Data    ReportData `json:"data"`
	Insight string     `json:"insight"`
	Cached  bool       `json:"cached,omitempty"`
}
