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

// IsCompanyAdmin reports whether userID is an ADMIN of companyID — used by
// member-management endpoints (add/remove/promote/demote). Being a plain
// member is not enough to change who else has access.
func IsCompanyAdmin(companyID, userID string) (bool, error) {
	var exists bool
	err := config.DB.QueryRow(
		`SELECT EXISTS(SELECT 1 FROM company_members WHERE company_id = $1 AND user_id = $2 AND is_admin = TRUE)`,
		companyID, userID,
	).Scan(&exists)
	return exists, err
}

// AdminCount returns how many admins a company currently has — used to
// block removing or demoting the last one, so a company can never end up
// with zero admins and nobody able to manage it.
func AdminCount(companyID string) (int, error) {
	var count int
	err := config.DB.QueryRow(
		`SELECT COUNT(*) FROM company_members WHERE company_id = $1 AND is_admin = TRUE`,
		companyID,
	).Scan(&count)
	return count, err
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

// CompanyIDForTransfer looks up the company a transfer is RECORDED under
// (i.e. the sending account's company at the time it was created) — used
// for the operations that should stay restricted to that one company, like
// changing a transfer's status.
func CompanyIDForTransfer(transferID string) (string, error) {
	var companyID string
	err := config.DB.QueryRow(`SELECT company_id FROM transfers WHERE id = $1`, transferID).Scan(&companyID)
	return companyID, err
}

// PartyCompanyIDsForTransfer returns BOTH companies involved in a transfer —
// the sender's (via from_account) and the recipient's (via to_account).
// Used for VIEWING a transfer, where either side should be able to see it,
// unlike CompanyIDForTransfer above which only returns the sender's side.
func PartyCompanyIDsForTransfer(transferID string) (fromCompanyID, toCompanyID string, err error) {
	err = config.DB.QueryRow(`
		SELECT fa.company_id, ta.company_id
		FROM transfers t
		JOIN accounts fa ON fa.id = t.from_account_id
		JOIN accounts ta ON ta.id = t.to_account_id
		WHERE t.id = $1`, transferID,
	).Scan(&fromCompanyID, &toCompanyID)
	return fromCompanyID, toCompanyID, err
}
