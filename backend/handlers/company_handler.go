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
// Creates the company and, in the same transaction, makes its creator the
// first member — otherwise the person who just made it couldn't see it on
// their own next GET /companies call.
func CreateCompany(c *gin.Context) {
	var input models.CreateCompanyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tx, err := config.DB.Begin()
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer tx.Rollback()

	var comp models.Company
	err = tx.QueryRow(`
		INSERT INTO company (company_name, created_by, updated_by)
		VALUES ($1, $2, $2)
		RETURNING id, company_name, created_at, updated_at, created_by, updated_by`,
		input.CompanyName, input.CreatedBy,
	).Scan(&comp.ID, &comp.CompanyName, &comp.CreatedAt, &comp.UpdatedAt, &comp.CreatedBy, &comp.UpdatedBy)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if _, err = tx.Exec(
		`INSERT INTO company_members (company_id, user_id) VALUES ($1, $2)`,
		comp.ID, input.CreatedBy,
	); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	if err := tx.Commit(); err != nil {
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, comp)
}

// GetCompanies handles GET /companies
// Returns ONLY companies the signed-in user is a member of — this is the
// fix for the bug where every user could previously see every company.
func GetCompanies(c *gin.Context) {
	userID := c.GetString("user_id")

	rows, err := config.DB.Query(`
		SELECT co.id, co.company_name, co.created_at, co.updated_at, co.created_by, co.updated_by
		FROM company co
		JOIN company_members cm ON cm.company_id = co.id
		WHERE cm.user_id = $1
		ORDER BY co.created_at DESC`, userID)
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
// Returns 404 — not 403 — for a company that exists but the user isn't a
// member of. This is deliberate: a 403 confirms the company exists, which
// is itself information an outsider shouldn't get. 404 reveals nothing.
func GetCompanyByID(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(id, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	var comp models.Company
	err = config.DB.QueryRow(`
		SELECT id, company_name, created_at, updated_at, created_by, updated_by
		FROM company WHERE id = $1`, id).
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

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(id, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	var input models.UpdateCompanyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var comp models.Company
	err = config.DB.QueryRow(`
		UPDATE company
		SET company_name = $1, updated_by = $2
		WHERE id = $3
		RETURNING id, company_name, created_at, updated_at, created_by, updated_by`,
		input.CompanyName, input.UpdatedBy, id,
	).Scan(&comp.ID, &comp.CompanyName, &comp.CreatedAt, &comp.UpdatedAt, &comp.CreatedBy, &comp.UpdatedBy)

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

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(id, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
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

// ListCompanyMembers handles GET /companies/:id/members
// Requires the requester to already be a member — you have to be inside a
// company to see who else is inside it.
func ListCompanyMembers(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(id, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	rows, err := config.DB.Query(`
		SELECT u.id, u.name, u.email, cm.created_at
		FROM company_members cm
		JOIN users u ON u.id = cm.user_id
		WHERE cm.company_id = $1
		ORDER BY cm.created_at ASC`, id)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	defer rows.Close()

	members := []models.CompanyMember{}
	for rows.Next() {
		var m models.CompanyMember
		if err := rows.Scan(&m.UserID, &m.Name, &m.Email, &m.CreatedAt); err != nil {
			utils.RespondDBError(c, err)
			return
		}
		members = append(members, m)
	}

	c.JSON(http.StatusOK, members)
}

// AddCompanyMember handles POST /companies/:id/members
// Adds another user (by email) to a company. Only existing members can add
// someone else — you can't add yourself to a company you don't belong to.
func AddCompanyMember(c *gin.Context) {
	id := c.Param("id")
	if !utils.IsValidUUID(id) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id format, expected a UUID"})
		return
	}

	userID := c.GetString("user_id")
	isMember, err := utils.IsCompanyMember(id, userID)
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}
	if !isMember {
		c.JSON(http.StatusNotFound, gin.H{"error": "company not found"})
		return
	}

	var input models.AddMemberInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var newUserID string
	err = config.DB.QueryRow(`SELECT id FROM users WHERE email = $1`, input.Email).Scan(&newUserID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "no user found with that email"})
		return
	}
	if err != nil {
		utils.RespondDBError(c, err)
		return
	}

	_, err = config.DB.Exec(
		`INSERT INTO company_members (company_id, user_id) VALUES ($1, $2)`,
		id, newUserID,
	)
	if err != nil {
		// Most commonly hit here: that user is already a member — a unique
		// constraint violation, returned as a clean 409.
		utils.RespondDBError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "member added"})
}
