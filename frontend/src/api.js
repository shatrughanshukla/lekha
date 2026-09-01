const BASE_URL = import.meta.env.VITE_API_URL
// Every call goes through here so the auth header and error handling are
// consistent in one place, instead of repeated at every call site.
async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  signUp: (name, email, password) =>
    request('/auth/signup', { method: 'POST', body: { name, email, password } }),
  signIn: (email, password) =>
    request('/auth/signin', { method: 'POST', body: { email, password } }),
  refreshToken: (token) => request('/auth/refresh', { method: 'POST', token }),

  getUser: (token, id) => request(`/users/${id}`, { token }),
  updateUser: (token, id, updates) => request(`/users/${id}`, { method: 'PUT', token, body: updates }),
  changePassword: (token, id, currentPassword, newPassword) =>
    request(`/users/${id}/password`, {
      method: 'PATCH',
      token,
      body: { current_password: currentPassword, new_password: newPassword },
    }),

  // Multipart upload — bypasses the JSON `request` helper above since this
  // needs a FormData body and must NOT set a JSON Content-Type header (the
  // browser sets its own multipart boundary automatically).
  uploadProfilePicture: async (token, id, file) => {
    const formData = new FormData()
    formData.append('photo', file)
    const res = await fetch(`${BASE_URL}/users/${id}/profile-picture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`)
    return data
  },
  removeProfilePicture: (token, id) => request(`/users/${id}/profile-picture`, { method: 'DELETE', token }),

  listCompanies: (token) => request('/companies', { token }),
  createCompany: (token, companyName, userId) =>
    request('/companies', { method: 'POST', token, body: { company_name: companyName, created_by: userId } }),
  deleteCompany: (token, id) => request(`/companies/${id}`, { method: 'DELETE', token }),

  listAccounts: (token, companyId) => request(`/accounts?company_id=${companyId}`, { token }),
  updateAccount: (token, id, { isActive, userId }) =>
    request(`/accounts/${id}`, { method: 'PUT', token, body: { is_active: isActive, updated_by: userId } }),
  // No company_id -> every account across every company this user belongs
  // to, used to populate the transfer "from" picker so money can move
  // between accounts in different companies the user owns.
  listMyAccounts: (token) => request('/accounts', { token }),
  createAccount: (token, { companyId, accountType, balance, userId }) =>
    request('/accounts', {
      method: 'POST',
      token,
      body: { company_id: companyId, account_type: accountType, current_balance: balance, created_by: userId },
    }),
  deleteAccount: (token, id) => request(`/accounts/${id}`, { method: 'DELETE', token }),

  listTransfers: (token, companyId) => request(`/transfers?company_id=${companyId}`, { token }),
  // No company_id here — the API derives which company this is recorded
  // under from the from_account itself. to_account_id can be ANY account
  // that exists, including ones in companies the user has no access to.
  // transfer_type is NOT sent — the backend derives it from the two
  // accounts' real types, so the user never has to pick it.
  createTransfer: (token, { fromAccountId, toAccountId, amount, notes, userId }) =>
    request('/transfers', {
      method: 'POST',
      token,
      body: {
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        transfer_notes: notes || null,
        created_by_user: userId,
      },
    }),
  searchTransfers: (token, companyId, query) =>
    request('/transfers/search', { method: 'POST', token, body: { company_id: companyId, query } }),
  getTransfer: (token, id) => request(`/transfers/${id}`, { token }),
  // Only ever proposes reversing an already-COMPLETED transfer — it does
  // not apply anything by itself unless the requester controls both
  // companies involved (see transfer_handler.go).
  proposeTransferReversal: (token, id, userId) =>
    request(`/transfers/${id}/propose`, { method: 'PATCH', token, body: { status: 'REVERSED', updated_by_user: userId } }),
  // Lets the company that proposed a reversal take it back before the
  // other side has responded.
  withdrawProposal: (token, id) => request(`/transfers/${id}/propose`, { method: 'DELETE', token }),
  // Answers whatever is currently awaiting a decision on this transfer —
  // a brand-new PENDING transfer, or a pending reversal proposal.
  respondToTransfer: (token, id, approve, userId) =>
    request(`/transfers/${id}/approval`, { method: 'PATCH', token, body: { approve, updated_by_user: userId } }),

  getSummary: (token, companyId) => request(`/companies/${companyId}/transfers/summary`, { token }),
  getInsights: (token, companyId) => request(`/companies/${companyId}/insights`, { token }),
  getOverviewInsights: (token) => request('/insights/overview', { token }),

  listMembers: (token, companyId) => request(`/companies/${companyId}/members`, { token }),
  addMember: (token, companyId, email) =>
    request(`/companies/${companyId}/members`, { method: 'POST', token, body: { email } }),
  removeMember: (token, companyId, userId) =>
    request(`/companies/${companyId}/members/${userId}`, { method: 'DELETE', token }),
  updateMemberRole: (token, companyId, userId, isAdmin) =>
    request(`/companies/${companyId}/members/${userId}`, { method: 'PATCH', token, body: { is_admin: isAdmin } }),
}

export const TRANSFER_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED', 'REVERSED']

export const ACCOUNT_TYPES = ['BANK', 'CASH']
export const TRANSFER_TYPES = [
  'CASH DEPOSIT IN BANK',
  'CASH WITHDRAWAL FROM BANK',
  'BANK TO BANK TRANSFER',
  'CASH ACCOUNT TRANSFER',
]
export const STATUS_COLORS = {
  PENDING: '#ffb84d',
  COMPLETED: '#2af0c0',
  CANCELLED: '#8d92c2',
  REVERSED: '#c084fc',
}
