package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// buildGlobalReport computes report numbers across every company the user
// belongs to — a "relevant" transfer is one where either side's account
// belongs to ANY of the user's companies. "Incoming"/"outgoing" here are
// relative to the user's own companies as a whole (money entering vs
// leaving the set of companies they control) — a transfer between two of
// the user's own companies counts as both incoming and outgoing, which is
// correct: it genuinely moved in on one side and out on the other.
func buildGlobalReport(userID string) (models.ReportData, error) {
	data := models.ReportData{
		Scope:          "global",
		CountByStatus:  map[string]int{},
		AmountByStatus: map[string]float64{},
		CountByType:    map[string]int{},
		AmountByType:   map[string]float64{},
	}

	const relevantCTE = `
		WITH my_companies AS (
			SELECT co.id FROM company co
			JOIN company_members cm ON cm.company_id = co.id
			WHERE cm.user_id = $1
		),
		relevant AS (
			SELECT DISTINCT t.id, t.amount, t.status, t.transfer_type, t.transaction_date,
			       t.from_account_id, t.to_account_id,
			       fa.company_id AS from_company_id, ta.company_id AS to_company_id
			FROM transfers t
			JOIN accounts fa ON fa.id = t.from_account_id
			JOIN accounts ta ON ta.id = t.to_account_id
			WHERE fa.company_id IN (SELECT id FROM my_companies)
			   OR ta.company_id IN (SELECT id FROM my_companies)
		)`

	row := config.DB.QueryRow(relevantCTE+`
		SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM relevant`, userID)
	if err := row.Scan(&data.TotalTransfers, &data.TotalAmount); err != nil {
		return data, err
	}

	row = config.DB.QueryRow(relevantCTE+`
		SELECT
			COALESCE(SUM(amount) FILTER (WHERE to_company_id IN (SELECT id FROM my_companies)), 0),
			COALESCE(SUM(amount) FILTER (WHERE from_company_id IN (SELECT id FROM my_companies)), 0)
		FROM relevant`, userID)
	if err := row.Scan(&data.IncomingTotal, &data.OutgoingTotal); err != nil {
		return data, err
	}

	statusRows, err := config.DB.Query(relevantCTE+`
		SELECT status, COUNT(*), COALESCE(SUM(amount), 0) FROM relevant GROUP BY status`, userID)
	if err != nil {
		return data, err
	}
	defer statusRows.Close()
	for statusRows.Next() {
		var status string
		var count int
		var amount float64
		if err := statusRows.Scan(&status, &count, &amount); err != nil {
			return data, err
		}
		data.CountByStatus[status] = count
		data.AmountByStatus[status] = amount
	}

	typeRows, err := config.DB.Query(relevantCTE+`
		SELECT transfer_type, COUNT(*), COALESCE(SUM(amount), 0) FROM relevant GROUP BY transfer_type`, userID)
	if err != nil {
		return data, err
	}
	defer typeRows.Close()
	for typeRows.Next() {
		var tType string
		var count int
		var amount float64
		if err := typeRows.Scan(&tType, &count, &amount); err != nil {
			return data, err
		}
		data.CountByType[tType] = count
		data.AmountByType[tType] = amount
	}

	tsRows, err := config.DB.Query(relevantCTE+`
		SELECT transaction_date::date, COUNT(*), COALESCE(SUM(amount), 0)
		FROM relevant GROUP BY 1 ORDER BY 1`, userID)
	if err != nil {
		return data, err
	}
	defer tsRows.Close()
	for tsRows.Next() {
		var point models.ReportTimeSeriesPoint
		if err := tsRows.Scan(&point.Date, &point.Count, &point.Amount); err != nil {
			return data, err
		}
		data.TimeSeries = append(data.TimeSeries, point)
	}

	// Top companies: the user's OWN companies, ranked by their total
	// transfer value (sent or received) — reuses the same "either side"
	// rule as the overview insights panel.
	topCoRows, err := config.DB.Query(`
		WITH my_companies AS (
			SELECT co.id, co.company_name FROM company co
			JOIN company_members cm ON cm.company_id = co.id
			WHERE cm.user_id = $1
		),
		pairs AS (
			SELECT fa.company_id AS company_id, t.id AS transfer_id, t.amount AS amount
			FROM transfers t JOIN accounts fa ON fa.id = t.from_account_id
			UNION
			SELECT ta.company_id AS company_id, t.id AS transfer_id, t.amount AS amount
			FROM transfers t JOIN accounts ta ON ta.id = t.to_account_id
		)
		SELECT mc.id, mc.company_name, COUNT(p.transfer_id), COALESCE(SUM(p.amount), 0)
		FROM my_companies mc
		LEFT JOIN pairs p ON p.company_id = mc.id
		GROUP BY mc.id, mc.company_name
		ORDER BY COALESCE(SUM(p.amount), 0) DESC
		LIMIT 5`, userID)
	if err != nil {
		return data, err
	}
	defer topCoRows.Close()
	for topCoRows.Next() {
		var e models.ReportTopEntry
		if err := topCoRows.Scan(&e.ID, &e.Name, &e.Count, &e.Amount); err != nil {
			return data, err
		}
		data.TopCompanies = append(data.TopCompanies, e)
	}

	// Top accounts: every account touched by a relevant transfer (either
	// side), ranked by total value it was involved in.
	topAcctRows, err := config.DB.Query(relevantCTE+`,
		account_activity AS (
			SELECT from_account_id AS account_id, amount FROM relevant
			UNION ALL
			SELECT to_account_id AS account_id, amount FROM relevant
		)
		SELECT a.id, a.account_type, co.company_name, COUNT(*), COALESCE(SUM(aa.amount), 0)
		FROM account_activity aa
		JOIN accounts a ON a.id = aa.account_id
		JOIN company co ON co.id = a.company_id
		GROUP BY a.id, a.account_type, co.company_name
		ORDER BY COALESCE(SUM(aa.amount), 0) DESC
		LIMIT 5`, userID)
	if err != nil {
		return data, err
	}
	defer topAcctRows.Close()
	for topAcctRows.Next() {
		var e models.ReportTopEntry
		if err := topAcctRows.Scan(&e.ID, &e.Name, &e.CompanyName, &e.Count, &e.Amount); err != nil {
			return data, err
		}
		data.TopAccounts = append(data.TopAccounts, e)
	}

	return data, nil
}

// buildCompanyReport is the same shape of report, scoped to one company —
// "incoming" is money received BY this company, "outgoing" is money sent
// BY it. Caller must already have verified company membership.
func buildCompanyReport(companyID, companyName string) (models.ReportData, error) {
	data := models.ReportData{
		Scope:          "company",
		CompanyID:      &companyID,
		CompanyName:    &companyName,
		CountByStatus:  map[string]int{},
		AmountByStatus: map[string]float64{},
		CountByType:    map[string]int{},
		AmountByType:   map[string]float64{},
	}

	const relevantCTE = `
		WITH relevant AS (
			SELECT t.id, t.amount, t.status, t.transfer_type, t.transaction_date,
			       t.from_account_id, t.to_account_id,
			       fa.company_id AS from_company_id, ta.company_id AS to_company_id
			FROM transfers t
			JOIN accounts fa ON fa.id = t.from_account_id
			JOIN accounts ta ON ta.id = t.to_account_id
			WHERE fa.company_id = $1 OR ta.company_id = $1
		)`

	row := config.DB.QueryRow(relevantCTE+`
		SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM relevant`, companyID)
	if err := row.Scan(&data.TotalTransfers, &data.TotalAmount); err != nil {
		return data, err
	}

	row = config.DB.QueryRow(relevantCTE+`
		SELECT
			COALESCE(SUM(amount) FILTER (WHERE to_company_id = $1), 0),
			COALESCE(SUM(amount) FILTER (WHERE from_company_id = $1), 0)
		FROM relevant`, companyID)
	if err := row.Scan(&data.IncomingTotal, &data.OutgoingTotal); err != nil {
		return data, err
	}

	statusRows, err := config.DB.Query(relevantCTE+`
		SELECT status, COUNT(*), COALESCE(SUM(amount), 0) FROM relevant GROUP BY status`, companyID)
	if err != nil {
		return data, err
	}
	defer statusRows.Close()
	for statusRows.Next() {
		var status string
		var count int
		var amount float64
		if err := statusRows.Scan(&status, &count, &amount); err != nil {
			return data, err
		}
		data.CountByStatus[status] = count
		data.AmountByStatus[status] = amount
	}

	typeRows, err := config.DB.Query(relevantCTE+`
		SELECT transfer_type, COUNT(*), COALESCE(SUM(amount), 0) FROM relevant GROUP BY transfer_type`, companyID)
	if err != nil {
		return data, err
	}
	defer typeRows.Close()
	for typeRows.Next() {
		var tType string
		var count int
		var amount float64
		if err := typeRows.Scan(&tType, &count, &amount); err != nil {
			return data, err
		}
		data.CountByType[tType] = count
		data.AmountByType[tType] = amount
	}

	tsRows, err := config.DB.Query(relevantCTE+`
		SELECT transaction_date::date, COUNT(*), COALESCE(SUM(amount), 0)
		FROM relevant GROUP BY 1 ORDER BY 1`, companyID)
	if err != nil {
		return data, err
	}
	defer tsRows.Close()
	for tsRows.Next() {
		var point models.ReportTimeSeriesPoint
		if err := tsRows.Scan(&point.Date, &point.Count, &point.Amount); err != nil {
			return data, err
		}
		data.TimeSeries = append(data.TimeSeries, point)
	}

	topAcctRows, err := config.DB.Query(relevantCTE+`,
		account_activity AS (
			SELECT from_account_id AS account_id, amount FROM relevant
			UNION ALL
			SELECT to_account_id AS account_id, amount FROM relevant
		)
		SELECT a.id, a.account_type, co.company_name, COUNT(*), COALESCE(SUM(aa.amount), 0)
		FROM account_activity aa
		JOIN accounts a ON a.id = aa.account_id
		JOIN company co ON co.id = a.company_id
		GROUP BY a.id, a.account_type, co.company_name
		ORDER BY COALESCE(SUM(aa.amount), 0) DESC
		LIMIT 5`, companyID)
	if err != nil {
		return data, err
	}
	defer topAcctRows.Close()
	for topAcctRows.Next() {
		var e models.ReportTopEntry
		if err := topAcctRows.Scan(&e.ID, &e.Name, &e.CompanyName, &e.Count, &e.Amount); err != nil {
			return data, err
		}
		data.TopAccounts = append(data.TopAccounts, e)
	}

	return data, nil
}

const reportsSystemPromptEN = `You are given a JSON object of already-computed, correct numeric statistics about bank transfer activity (either for one company, or across every company a user belongs to — check the "scope" field). All amounts are in Indian Rupees — always write them with the ₹ symbol (e.g. ₹16,900), never $ or USD. Write a short, plain-English narrative (4-6 sentences) for a business owner reading their reports page: summarize the overall trend, call out the busiest period or largest single-day activity from the time_series data if there's a clear pattern, note the balance between incoming and outgoing totals, mention which status or transfer type dominates, and flag anything that looks like an anomaly (e.g. an unusually large cancelled/reversed amount, or a company/account with disproportionately high activity). Do not invent, estimate, or recalculate any number — only describe the numbers given to you, in your own words. Do not mention JSON or that you were given data. Write only the narrative, no preamble.`
const reportsSystemPromptHI = `आपको बैंक ट्रांसफर गतिविधि के बारे में पहले से गणना किए गए, सही संख्यात्मक आंकड़ों वाला एक JSON ऑब्जेक्ट दिया गया है (या तो एक कंपनी के लिए, या उपयोगकर्ता की सभी कंपनियों में — "scope" फ़ील्ड देखें)। सभी राशियां भारतीय रुपयों में हैं — हमेशा ₹ चिह्न के साथ लिखें, कभी $ या USD नहीं। एक व्यवसाय मालिक के लिए शुद्ध, सरल हिंदी में एक छोटा विवरण (4-6 वाक्य) लिखें: कुल रुझान बताएं, time_series डेटा में कोई स्पष्ट पैटर्न हो तो सबसे व्यस्त अवधि बताएं, आने वाली और जाने वाली राशि का संतुलन बताएं, कौन सी स्थिति या ट्रांसफर प्रकार सबसे अधिक है यह बताएं, और कोई असामान्य बात (जैसे असामान्य रूप से बड़ी रद्द/उलटी राशि) हो तो उसका उल्लेख करें। दिए गए आंकड़ों में से किसी की भी कल्पना, अनुमान या पुनर्गणना न करें। JSON या डेटा दिए जाने का ज़िक्र न करें। केवल विवरण लिखें, कोई प्रस्तावना नहीं। पूरा जवाब हिंदी (देवनागरी लिपि) में लिखें।`

// GetReports handles GET /reports?company_id=<optional>
// Omit company_id for the global (all your companies) report.
func GetReports(c *gin.Context) {
	userID := c.GetString("user_id")
	lang := utils.LangFromContext(c)
	companyID := c.Query("company_id")

	var data models.ReportData
	var cacheKey string
	var err error

	if companyID == "" {
		data, err = buildGlobalReport(userID)
		cacheKey = "report:global:" + userID + ":" + string(lang)
	} else {
		if !utils.IsValidUUID(companyID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_company_id")})
			return
		}
		isMember, mErr := utils.IsCompanyMember(companyID, userID)
		if mErr != nil {
			utils.RespondDBError(c, mErr)
			return
		}
		if !isMember {
			c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "company_not_found")})
			return
		}
		var companyName string
		nameErr := config.DB.QueryRow(`SELECT company_name FROM company WHERE id = $1`, companyID).Scan(&companyName)
		if nameErr == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "company_not_found")})
			return
		}
		if nameErr != nil {
			utils.RespondDBError(c, nameErr)
			return
		}
		data, err = buildCompanyReport(companyID, companyName)
		cacheKey = "report:company:" + companyID + ":" + string(lang)
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	dataJSON, err := json.Marshal(data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "summary_prep_failed")})
		return
	}
	dataHash := utils.HashSummary(dataJSON)

	if cached, ok := utils.GetCachedInsight(cacheKey, dataHash); ok {
		c.JSON(http.StatusOK, models.ReportsResponse{Data: data, Insight: cached, Cached: true})
		return
	}

	prompt := reportsSystemPromptEN
	if lang == utils.LangHI {
		prompt = reportsSystemPromptHI
	}

	insight, err := utils.CallGemini(prompt, string(dataJSON))
	if err != nil {
		c.JSON(http.StatusOK, models.ReportsResponse{
			Data:    data,
			Insight: utils.Msg(c, "ai_summary_unavailable") + err.Error(),
		})
		return
	}
	utils.SetCachedInsight(cacheKey, dataHash, insight)

	c.JSON(http.StatusOK, models.ReportsResponse{Data: data, Insight: insight})
}
