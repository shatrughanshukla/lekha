package utils

import "lekha-api/config"

// IsCompanyMember reports whether userID is a member of companyID — the
// central check that every company-scoped endpoint runs before returning
// anything. Without this, a signed-in user could read or modify any
// company's data just by knowing (or guessing) its UUID, regardless of
// whether they created it or were ever added to it.
func IsCompanyMember(companyID, userID string) (bool, error) {
	var exists bool
	err := config.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM company_members WHERE company_id = $1 AND user_id = $2)`,
		companyID, userID,
	).Scan(&exists)
	return exists, err
}

// CompanyIDForAccount looks up which company an account belongs to — used
// by account-level endpoints (GET/PUT/DELETE /accounts/:id) that only have
// the account's own ID, not the company's, so they can still run the
// membership check above before doing anything with that account.
func CompanyIDForAccount(accountID string) (string, error) {
	var companyID string
	err := config.DB.QueryRow(`SELECT company_id FROM accounts WHERE id = $1`, accountID).Scan(&companyID)
	return companyID, err
}

// CompanyIDForTransfer looks up which company a transfer belongs to — same
// purpose as CompanyIDForAccount, for transfer-level endpoints.
func CompanyIDForTransfer(transferID string) (string, error) {
	var companyID string
	err := config.DB.QueryRow(`SELECT company_id FROM transfers WHERE id = $1`, transferID).Scan(&companyID)
	return companyID, err
}
