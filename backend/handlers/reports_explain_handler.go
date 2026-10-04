package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// chartDescriptions tells the model exactly what each Reports chart plots and
// where its numbers are in the payload, so the explanation describes the
// chart the user is actually looking at. The keys are the only chart ids the
// endpoint accepts.
var chartDescriptions = map[string]string{
	"volume": "A line chart over time. For every day with activity it plots two lines: the total transfer amount in rupees (left axis) and the number of transfers (right axis). The points are in data.time_series (date, amount, count).",
	"status": "A donut chart that splits all transfers in the period by status: COMPLETED, PENDING, REVERSED and CANCELLED. Counts are in data.count_by_status and rupee totals in data.amount_by_status.",
	"companies": "A ranked bar list of the user's companies with the highest total transfer value in the period (data.top_companies). Each bar's length is that company's share relative to the top one.",
	"flow": "Two bars comparing money coming in (data.incoming_total) with money going out (data.outgoing_total) in the period. In the all-companies view a transfer between two of the user's own companies counts on both sides.",
	"type": "A donut chart that splits transfers by type, such as bank to bank, cash deposit in bank or cash withdrawal from bank. Counts are in data.count_by_type and rupee totals in data.amount_by_type.",
	"accounts": "A ranked bar list of the individual accounts with the highest total transfer value in the period (data.top_accounts). Each entry has the account type and the company that owns it.",
}

// Each click calls the LLM, so cap how fast one user can do it. The result is
// also cached (below), so re-opening the same chart costs nothing.
var explainLimiter = utils.NewRateLimiter(30, time.Hour)

// explainTransfer is one real transfer handed to the model as evidence. Only
// non-sensitive fields are included: no ids, and no free-text notes (those are
// user-written text that has no business inside a prompt).
type explainTransfer struct {
	Date   string  `json:"date"`
	Type   string  `json:"type"`
	Status string  `json:"status"`
	Amount float64 `json:"amount"`
	From   string  `json:"from"`
	To     string  `json:"to"`
}

type reportExplainPayload struct {
	Chart                 string            `json:"chart"`
	ChartDescription      string            `json:"chart_description"`
	Data                  models.ReportData `json:"data"`
	LargestTransfers      []explainTransfer `json:"largest_transfers"`
	RecentTransfers       []explainTransfer `json:"recent_transfers"`
	NonCompletedTransfers []explainTransfer `json:"non_completed_transfers,omitempty"`
}

// ReportExplainResponse is the payload for GET /reports/explain.
type ReportExplainResponse struct {
	Chart       string `json:"chart"`
	Explanation string `json:"explanation"`
	Cached      bool   `json:"cached,omitempty"`
}

const reportExplainPromptEN = `You explain ONE specific chart from the Reports page of a company-finance app to a business owner who is not a finance expert. You are given a JSON object with: "chart" (which chart), "chart_description" (what it plots and how to read it), "data" (the already-computed report numbers for the selected period and scope), and lists of real transfers behind those numbers ("largest_transfers", "recent_transfers" and, for the status chart, "non_completed_transfers"). All amounts are Indian Rupees: always write them with the ₹ symbol and Indian digit grouping (for example ₹1,00,000), never $ or USD.

Write 5 to 8 sentences of plain prose: no markdown, no bullet points, no headings. Start by saying what the chart shows and how to read it (what the axes, slices or bars mean). Then give the main takeaway with the exact numbers: the highest and lowest points or the biggest and smallest shares, any imbalance, and anything that dominates (for example a single transfer making up most of the total). Point at specific real transfers from the lists that explain the shape of the chart, naming their date, the companies involved and the amount exactly as given. Finish with one sentence on anything unusual worth a second look, or say that nothing looks unusual.

Use only the numbers, dates, companies and transfers in the JSON. Do not invent, estimate or recalculate any figure, and do not guess at reasons or causes that are not in the data; if the data is too thin to conclude something, say so plainly. Do not give financial advice or tell the user what to do. Never mention JSON, fields or that you were given data. Write only the explanation, with no preamble.`

const reportExplainPromptHI = `आप एक कंपनी-फ़ाइनेंस ऐप के रिपोर्ट पेज के किसी एक विशेष चार्ट को एक ऐसे व्यवसाय मालिक को समझा रहे हैं जो फ़ाइनेंस के विशेषज्ञ नहीं हैं। आपको एक JSON ऑब्जेक्ट दिया गया है जिसमें हैं: "chart" (कौन सा चार्ट), "chart_description" (वह क्या दिखाता है और उसे कैसे पढ़ें), "data" (चुनी गई अवधि और दायरे के पहले से गणना किए गए रिपोर्ट आंकड़े), और उन आंकड़ों के पीछे के वास्तविक ट्रांसफर की सूचियां ("largest_transfers", "recent_transfers" और स्टेटस चार्ट के लिए "non_completed_transfers")। सभी राशियां भारतीय रुपयों में हैं: हमेशा ₹ चिह्न और भारतीय अंक-समूहन (जैसे ₹1,00,000) के साथ लिखें, कभी $ या USD नहीं।

शुद्ध, सरल हिंदी में 5 से 8 वाक्यों का सादा गद्य लिखें: कोई मार्कडाउन, बुलेट पॉइंट या शीर्षक नहीं। पहले बताएं कि चार्ट क्या दिखाता है और उसे कैसे पढ़ें (अक्ष, हिस्से या बार का क्या अर्थ है)। फिर सटीक आंकड़ों के साथ मुख्य निष्कर्ष बताएं: सबसे ऊंचे और सबसे निचले बिंदु या सबसे बड़े और सबसे छोटे हिस्से, कोई असंतुलन, और जो कुछ हावी है (जैसे कोई एक ट्रांसफर जो कुल का बड़ा हिस्सा है)। सूचियों में से उन वास्तविक ट्रांसफर की ओर संकेत करें जो चार्ट के आकार को समझाते हैं, उनकी तारीख, शामिल कंपनियां और राशि ठीक वैसी ही बताएं जैसी दी गई है। अंत में एक वाक्य में कोई असामान्य बात बताएं जिसे दोबारा देखना चाहिए, या कहें कि कुछ भी असामान्य नहीं दिखता।

केवल JSON में दिए गए आंकड़ों, तारीखों, कंपनियों और ट्रांसफर का उपयोग करें। किसी भी आंकड़े की कल्पना, अनुमान या पुनर्गणना न करें, और ऐसे कारणों का अंदाज़ा न लगाएं जो डेटा में नहीं हैं; यदि डेटा किसी निष्कर्ष के लिए बहुत कम है तो साफ़ कहें। वित्तीय सलाह न दें और यह न बताएं कि उपयोगकर्ता को क्या करना चाहिए। JSON, फ़ील्ड या डेटा दिए जाने का कभी ज़िक्र न करें। केवल व्याख्या लिखें, कोई प्रस्तावना नहीं। पूरा जवाब हिंदी (देवनागरी लिपि) में लिखें।`

// queryExplainTransfers returns up to `limit` real transfers for the report's
// scope and date window. `cte` / `scope` come from the caller (global vs one
// company), `extraWhere` is the date filter (and optionally a status filter),
// and every query shares the same placeholder list in `args`.
func queryExplainTransfers(cte, scope string, args []interface{}, extraWhere, orderBy string, limit int) ([]explainTransfer, error) {
	query := cte + `
		SELECT t.transaction_date, t.transfer_type, t.status, t.amount,
		       fc.company_name, tc.company_name, fa.account_type, ta.account_type
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN company fc ON fc.id = fa.company_id
		JOIN accounts ta ON ta.id = t.to_account_id
		JOIN company tc ON tc.id = ta.company_id
		WHERE ` + scope + extraWhere + `
		ORDER BY ` + orderBy + `
		LIMIT ` + strconv.Itoa(limit)

	rows, err := config.DB.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []explainTransfer{}
	for rows.Next() {
		var tr explainTransfer
		var date time.Time
		var fromCompany, toCompany, fromType, toType string
		if err := rows.Scan(&date, &tr.Type, &tr.Status, &tr.Amount, &fromCompany, &toCompany, &fromType, &toType); err != nil {
			return nil, err
		}
		tr.Date = date.Format("2006-01-02")
		tr.From = fromCompany + " (" + fromType + ")"
		tr.To = toCompany + " (" + toType + ")"
		out = append(out, tr)
	}
	return out, rows.Err()
}

// ExplainReportChart handles
//
//	GET /reports/explain?chart=<volume|status|companies|flow|type|accounts>
//	                    &company_id=<optional>&since=<RFC3339 optional>&until=<RFC3339 optional>
//
// It recomputes the report numbers for the same scope and window the Reports
// page is showing, pulls the real transfers behind them, and asks the model to
// explain that one chart from exactly that data. As everywhere else in Lekha,
// the numbers are computed in SQL/Go first; the model only describes them.
func ExplainReportChart(c *gin.Context) {
	userID := c.GetString("user_id")
	lang := utils.LangFromContext(c)

	chart := c.Query("chart")
	description, known := chartDescriptions[chart]
	companyID := c.Query("company_id")
	// "Top companies" ranks the user's companies against each other, which
	// only exists in the all-companies view.
	if !known || (chart == "companies" && companyID != "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_chart")})
		return
	}

	since, err := parseReportTimeParam(c.Query("since"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}
	until, err := parseReportTimeParam(c.Query("until"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_request_data")})
		return
	}

	rangeKey := "all"
	if since != nil {
		rangeKey = since.Format(time.RFC3339)
	}
	if until != nil {
		rangeKey += "_" + until.Format(time.RFC3339)
	}

	var (
		data       models.ReportData
		scopeCTE   string
		scopeWhere string
		scopeArg   string
		cacheKey   string
	)

	if companyID == "" {
		data, err = buildGlobalReport(userID, since, until)
		scopeCTE = `WITH my_companies AS (
			SELECT co.id FROM company co
			JOIN company_members cm ON cm.company_id = co.id
			WHERE cm.user_id = $1 AND co.deleted_at IS NULL
		)`
		scopeWhere = `(fa.company_id IN (SELECT id FROM my_companies) OR ta.company_id IN (SELECT id FROM my_companies))`
		scopeArg = userID
		cacheKey = "explain:global:" + userID + ":" + chart + ":" + string(lang) + ":" + rangeKey
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
		data, err = buildCompanyReport(companyID, companyName, since, until)
		scopeWhere = `(fa.company_id = $1 OR ta.company_id = $1)`
		scopeArg = companyID
		cacheKey = "explain:company:" + companyID + ":" + chart + ":" + string(lang) + ":" + rangeKey
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	// An empty period has nothing to explain.
	if data.TotalTransfers == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "explain_no_data")})
		return
	}

	df := newDateFilter(since, until, 1) // $1 is the user / company id
	args := append([]interface{}{scopeArg}, df.args...)

	largest, err := queryExplainTransfers(scopeCTE, scopeWhere, args, df.sql, "t.amount DESC, t.transaction_date DESC", 12)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	recent, err := queryExplainTransfers(scopeCTE, scopeWhere, args, df.sql, "t.transaction_date DESC, t.created_at DESC", 10)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	payload := reportExplainPayload{
		Chart:            chart,
		ChartDescription: description,
		Data:             data,
		LargestTransfers: largest,
		RecentTransfers:  recent,
	}
	if chart == "status" {
		// The status chart is about what is NOT completed: show those.
		payload.NonCompletedTransfers, err = queryExplainTransfers(scopeCTE, scopeWhere, args, df.sql+` AND t.status <> 'COMPLETED'`, "t.amount DESC", 8)
		if err != nil {
			utils.RespondDBError(c, err)
			return
		}
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "summary_prep_failed")})
		return
	}
	dataHash := utils.HashSummary(payloadJSON)

	// Same data as last time -> same explanation, no model call.
	if cached, ok := utils.GetCachedInsight(cacheKey, dataHash); ok {
		c.JSON(http.StatusOK, ReportExplainResponse{Chart: chart, Explanation: cached, Cached: true})
		return
	}

	if !explainLimiter.Allow(userID) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": utils.Msg(c, "too_many_explain_requests")})
		return
	}

	prompt := reportExplainPromptEN
	if lang == utils.LangHI {
		prompt = reportExplainPromptHI
	}
	explanation, err := utils.CallGemini(prompt, string(payloadJSON))
	if err != nil {
		// Deliberately not echoing err to the client: the underlying HTTP error
		// can contain the request URL. The log line carries no error text for
		// the same reason.
		log.Printf("reports explain: model call failed (chart=%s)", chart)
		c.JSON(http.StatusBadGateway, gin.H{"error": utils.Msg(c, "explain_unavailable")})
		return
	}
	utils.SetCachedInsight(cacheKey, dataHash, explanation)

	c.JSON(http.StatusOK, ReportExplainResponse{Chart: chart, Explanation: explanation})
}
