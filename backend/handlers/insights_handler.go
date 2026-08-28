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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	summary, err := buildTransferSummary(companyID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, summary)
}

const insightsSystemPrompt = `You are given a JSON object of already-computed, correct numeric statistics about a company's bank transfer activity. Write a short, plain-English paragraph (2-4 sentences) summarizing it for a business owner glancing at their dashboard. Do not invent, estimate, or recalculate any number — only describe the numbers given to you, in your own words. Do not mention JSON or that you were given data. Write only the summary paragraph, no preamble.`

// GetCompanyInsights handles GET /companies/:id/insights
//
// The numeric summary is computed first, entirely in Go/SQL — that part is
// always correct regardless of the AI layer. Only those already-computed
// numbers (never raw transfer rows) are then handed to the LLM, which only
// ever phrases them into a sentence — it never calculates anything itself.
func GetCompanyInsights(c *gin.Context) {
	companyID := c.Param("id")
	if !utils.IsValidUUID(companyID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(companyID, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	summary, err := buildTransferSummary(companyID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare summary for insight generation"})
		return
	}

	insight, err := utils.CallGemini(insightsSystemPrompt, string(summaryJSON))
	if err != nil {
		// The numeric summary is still fully correct and useful even if the
		// AI paragraph fails — degrade gracefully instead of failing the
		// whole request just because the AI layer had a hiccup.
		c.JSON(http.StatusOK, models.CompanyInsightsResponse{
			Summary: summary,
			Insight: "AI summary unavailable right now: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.CompanyInsightsResponse{
		Summary: summary,
		Insight: insight,
	})
}
