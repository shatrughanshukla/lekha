package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// buildTransferSummary computes a company's transfer activity numbers with
// plain SQL — no AI involved. This is the single source of truth for every
// number GetCompanyInsights later hands to the LLM to phrase.
//
// A transfer counts toward a company if EITHER its from_account or its
// to_account belongs to that company — same rule as GetTransfers uses for
// the transfer list. Earlier this only checked the transfer's stored
// company_id, which is always the SENDING company, so any transfer where
// this company was only the RECEIVING side was silently excluded — the
// list would show it correctly but insights would report zero activity.
func buildTransferSummary(companyID string) (models.TransferSummary, error) {
	summary := models.TransferSummary{
		CompanyID:     companyID,
		CountByStatus: map[string]int{},
		CountByType:   map[string]int{},
	}

	row := config.DB.QueryRow(`
		SELECT COUNT(*), COALESCE(SUM(t.amount), 0), COALESCE(MAX(t.amount), 0)
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN accounts ta ON ta.id = t.to_account_id
		WHERE fa.company_id = $1 OR ta.company_id = $1`, companyID)
	if err := row.Scan(&summary.TotalTransfers, &summary.TotalAmount, &summary.LargestTransfer); err != nil {
		return summary, err
	}

	statusRows, err := config.DB.Query(`
		SELECT t.status, COUNT(*)
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN accounts ta ON ta.id = t.to_account_id
		WHERE fa.company_id = $1 OR ta.company_id = $1
		GROUP BY t.status`, companyID)
	if err != nil {
		return summary, err
	}
	defer statusRows.Close()
	for statusRows.Next() {
		var status string
		var count int
		if err := statusRows.Scan(&status, &count); err != nil {
			return summary, err
		}
		summary.CountByStatus[status] = count
	}

	typeRows, err := config.DB.Query(`
		SELECT t.transfer_type, COUNT(*)
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN accounts ta ON ta.id = t.to_account_id
		WHERE fa.company_id = $1 OR ta.company_id = $1
		GROUP BY t.transfer_type`, companyID)
	if err != nil {
		return summary, err
	}
	defer typeRows.Close()
	for typeRows.Next() {
		var transferType string
		var count int
		if err := typeRows.Scan(&transferType, &count); err != nil {
			return summary, err
		}
		summary.CountByType[transferType] = count
	}

	return summary, nil
}

// GetCompanyTransferSummary handles GET /companies/:id/transfers/summary
// Pure Go/SQL — no AI. This is the numeric foundation GetCompanyInsights
// phrases into English below; it's also useful standalone for a dashboard.
func GetCompanyTransferSummary(c *gin.Context) {
	companyID := c.Param("id")
	if !utils.IsValidUUID(companyID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "company_not_found")})
		return
	}

	summary, err := buildTransferSummary(companyID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, summary)
}

// buildOverviewSummary computes, for every company the given user belongs
// to, that company's transfer activity — reusing buildTransferSummary (the
// same sender-OR-receiver rule already used for a single company) rather
// than re-deriving the join logic, so the two never drift out of sync.
func buildOverviewSummary(userID string) (models.OverviewSummary, error) {
	overview := models.OverviewSummary{Companies: []models.CompanyActivity{}}

	rows, err := config.DB.Query(`
		SELECT co.id, co.company_name
		FROM company co
		JOIN company_members cm ON cm.company_id = co.id
		WHERE cm.user_id = $1
		ORDER BY co.created_at DESC`, userID)
	if err != nil {
		return overview, err
	}
	defer rows.Close()

	type companyRow struct{ id, name string }
	var companyRows []companyRow
	for rows.Next() {
		var cr companyRow
		if err := rows.Scan(&cr.id, &cr.name); err != nil {
			return overview, err
		}
		companyRows = append(companyRows, cr)
	}
	if err := rows.Err(); err != nil {
		return overview, err
	}

	overview.TotalCompanies = len(companyRows)

	for _, cr := range companyRows {
		txSummary, err := buildTransferSummary(cr.id)
		if err != nil {
			return overview, err
		}
		if txSummary.TotalTransfers > 0 {
			overview.CompaniesWithActivity++
		}
		overview.TotalAmountAllCompanies += txSummary.TotalAmount
		overview.Companies = append(overview.Companies, models.CompanyActivity{
			CompanyID:      cr.id,
			CompanyName:    cr.name,
			TotalTransfers: txSummary.TotalTransfers,
			TotalAmount:    txSummary.TotalAmount,
		})
	}

	return overview, nil
}

const overviewSystemPromptEN = `You are given a JSON object of already-computed, correct numeric statistics about a user's companies and their bank transfer activity, across every company they belong to. Write a short, plain-English paragraph (3-5 sentences) summarizing it for a business owner glancing at their dashboard — mention how many companies they have, which company or companies are the most active or hold the most transaction value, and call out any company with no activity yet. Do not invent, estimate, or recalculate any number — only describe the numbers given to you, in your own words. Do not mention JSON or that you were given data. Write only the summary paragraph, no preamble.`
const overviewSystemPromptHI = `आपको एक कंपनी के उपयोगकर्ता की सभी कंपनियों और उनकी बैंक ट्रांसफर गतिविधि के बारे में पहले से गणना किए गए, सही संख्यात्मक आंकड़ों वाला एक JSON ऑब्जेक्ट दिया गया है। इसे शुद्ध, सरल हिंदी में एक छोटे पैराग्राफ (3-5 वाक्य) में लिखें, जो एक व्यवसाय मालिक अपने डैशबोर्ड पर देखे — बताएं कि उनकी कितनी कंपनियां हैं, कौन सी कंपनी या कंपनियां सबसे सक्रिय हैं या सबसे ज़्यादा राशि की लेन-देन रखती हैं, और किसी भी कंपनी में अभी तक कोई गतिविधि न होने का ज़िक्र करें। दिए गए आंकड़ों में से किसी की भी कल्पना, अनुमान या पुनर्गणना न करें — केवल दिए गए आंकड़ों को अपने शब्दों में बताएं। JSON या डेटा दिए जाने का ज़िक्र न करें। केवल सारांश पैराग्राफ लिखें, कोई प्रस्तावना नहीं। पूरा जवाब हिंदी (देवनागरी लिपि) में लिखें।`

// GetOverviewInsights handles GET /insights/overview
//
// Same pattern as GetCompanyInsights: the numeric summary is computed
// first, entirely in Go/SQL, and is always correct on its own. Only those
// already-computed numbers are handed to the LLM, which only ever phrases
// them into a paragraph — it never calculates anything itself.
func GetOverviewInsights(c *gin.Context) {
	userID := c.GetString("user_id")
	lang := utils.LangFromContext(c)

	summary, err := buildOverviewSummary(userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "summary_prep_failed")})
		return
	}

	// Language is part of the cache key — otherwise a Hindi-preferring
	// user could be served an English paragraph a teammate generated
	// first for the exact same underlying numbers, or vice versa.
	cacheKey := "overview:" + userID + ":" + string(lang)
	summaryHash := utils.HashSummary(summaryJSON)

	if cached, ok := utils.GetCachedInsight(cacheKey, summaryHash); ok {
		c.JSON(http.StatusOK, models.OverviewInsightsResponse{Summary: summary, Insight: cached, Cached: true})
		return
	}

	prompt := overviewSystemPromptEN
	if lang == utils.LangHI {
		prompt = overviewSystemPromptHI
	}

	insight, err := utils.CallGemini(prompt, string(summaryJSON))
	if err != nil {
		// The numeric summary is still fully correct and useful even if the
		// AI paragraph fails — degrade gracefully instead of failing the
		// whole request just because the AI layer had a hiccup. Deliberately
		// NOT cached, so the next request tries Gemini again instead of
		// getting stuck repeating a failure message.
		c.JSON(http.StatusOK, models.OverviewInsightsResponse{
			Summary: summary,
			Insight: utils.Msg(c, "ai_summary_unavailable") + err.Error(),
		})
		return
	}
	utils.SetCachedInsight(cacheKey, summaryHash, insight)

	c.JSON(http.StatusOK, models.OverviewInsightsResponse{
		Summary: summary,
		Insight: insight,
	})
}

const insightsSystemPromptEN = `You are given a JSON object of already-computed, correct numeric statistics about a company's bank transfer activity. Write a short, plain-English paragraph (2-4 sentences) summarizing it for a business owner glancing at their dashboard. Do not invent, estimate, or recalculate any number — only describe the numbers given to you, in your own words. Do not mention JSON or that you were given data. Write only the summary paragraph, no preamble.`
const insightsSystemPromptHI = `आपको एक कंपनी की बैंक ट्रांसफर गतिविधि के बारे में पहले से गणना किए गए, सही संख्यात्मक आंकड़ों वाला एक JSON ऑब्जेक्ट दिया गया है। इसे शुद्ध, सरल हिंदी में एक छोटे पैराग्राफ (2-4 वाक्य) में लिखें, जो एक व्यवसाय मालिक अपने डैशबोर्ड पर देखे। दिए गए आंकड़ों में से किसी की भी कल्पना, अनुमान या पुनर्गणना न करें — केवल दिए गए आंकड़ों को अपने शब्दों में बताएं। JSON या डेटा दिए जाने का ज़िक्र न करें। केवल सारांश पैराग्राफ लिखें, कोई प्रस्तावना नहीं। पूरा जवाब हिंदी (देवनागरी लिपि) में लिखें।`

// GetCompanyInsights handles GET /companies/:id/insights
//
// The numeric summary is computed first, entirely in Go/SQL — that part is
// always correct regardless of the AI layer. Only those already-computed
// numbers (never raw transfer rows) are then handed to the LLM, which only
// ever phrases them into a sentence — it never calculates anything itself.
func GetCompanyInsights(c *gin.Context) {
	companyID := c.Param("id")
	if !utils.IsValidUUID(companyID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": utils.Msg(c, "invalid_id")})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": utils.Msg(c, "company_not_found")})
		return
	}

	summary, err := buildTransferSummary(companyID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": utils.Msg(c, "summary_prep_failed")})
		return
	}

	lang := utils.LangFromContext(c)
	// Language is part of the cache key — see the identical comment in
	// GetOverviewInsights for why.
	cacheKey := "company:" + companyID + ":" + string(lang)
	summaryHash := utils.HashSummary(summaryJSON)

	if cached, ok := utils.GetCachedInsight(cacheKey, summaryHash); ok {
		c.JSON(http.StatusOK, models.CompanyInsightsResponse{Summary: summary, Insight: cached, Cached: true})
		return
	}

	prompt := insightsSystemPromptEN
	if lang == utils.LangHI {
		prompt = insightsSystemPromptHI
	}

	insight, err := utils.CallGemini(prompt, string(summaryJSON))
	if err != nil {
		// The numeric summary is still fully correct and useful even if the
		// AI paragraph fails — degrade gracefully instead of failing the
		// whole request just because the AI layer had a hiccup. Deliberately
		// NOT cached, so the next request tries Gemini again instead of
		// getting stuck repeating a failure message.
		c.JSON(http.StatusOK, models.CompanyInsightsResponse{
			Summary: summary,
			Insight: utils.Msg(c, "ai_summary_unavailable") + err.Error(),
		})
		return
	}
	utils.SetCachedInsight(cacheKey, summaryHash, insight)

	c.JSON(http.StatusOK, models.CompanyInsightsResponse{
		Summary: summary,
		Insight: insight,
	})
}
