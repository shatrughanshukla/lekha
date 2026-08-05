package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"lekha-api/config"
	"lekha-api/models"
	"lekha-api/utils"
)

// CreateCompany handles POST /companies
func CreateCompany(c *gin.Context) {
	var input models.CreateCompanyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		INSERT INTO company (company_name, created_by, updated_by)
		VALUES ($1, $2, $2)
		RETURNING id, company_name, created_at, updated_at, created_by, updated_by`

	var comp models.Company
	err := config.DB.QueryRow(query, input.CompanyName, input.CreatedBy).
		Scan(&comp.ID, &comp.CompanyName, &comp.CreatedAt, &comp.UpdatedAt, &comp.CreatedBy, &comp.UpdatedBy)
	if err != nil {
		// Most commonly hit here: created_by is a well-formed UUID that
		// doesn't match any real user — a foreign-key violation, now
		// returned as a clean 400 instead of a raw 500.
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, comp)
}

// GetCompanies handles GET /companies
func GetCompanies(c *gin.Context) {
	rows, err := config.DB.Query(`
		SELECT id, company_name, created_at, updated_at, created_by, updated_by
		FROM company ORDER BY created_at DESC`)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	companies := []models.Company{}
	for rows.Next() {
		var comp models.Company
		if err := rows.Scan(&comp.ID, &comp.CompanyName, &comp.CreatedAt, &comp.UpdatedAt, &comp.CreatedBy, &comp.UpdatedBy); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		companies = append(companies, comp)
	}

	c.JSON(http.StatusOK, companies)
}

// GetCompanyByID handles GET /companies/:id
func GetCompanyByID(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	var comp models.Company
	query := `
		SELECT id, company_name, created_at, updated_at, created_by, updated_by
		FROM company WHERE id = $1`
	err := config.DB.QueryRow(query, id).
		Scan(&comp.ID, &comp.CompanyName, &comp.CreatedAt, &comp.UpdatedAt, &comp.CreatedBy, &comp.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, comp)
}

// UpdateCompany handles PUT /companies/:id
func UpdateCompany(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	var input models.UpdateCompanyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	query := `
		UPDATE company
		SET company_name = $1, updated_by = $2
		WHERE id = $3
		RETURNING id, company_name, created_at, updated_at, created_by, updated_by`

	var comp models.Company
	err := config.DB.QueryRow(query, input.CompanyName, input.UpdatedBy, id).
		Scan(&comp.ID, &comp.CompanyName, &comp.CreatedAt, &comp.UpdatedAt, &comp.CreatedBy, &comp.UpdatedBy)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusOK, comp)
}

// DeleteCompany handles DELETE /companies/:id
func DeleteCompany(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	result, err := config.DB.Exec(`DELETE FROM company WHERE id = $1`, id)
	if err != nil {
		// Most commonly hit here: the company still has accounts (or
		// transfers) referencing it — a foreign-key violation, now
		// returned as a clean 400 instead of a raw 500.
		utils.RespondDBError(c, err)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "company deleted"})
}
