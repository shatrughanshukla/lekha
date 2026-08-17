const BASE_URL = 'http://localhost:8080/api/v1'

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

  listCompanies: (token) => request('/companies', { token }),
  createCompany: (token, companyName, userId) =>
    request('/companies', { method: 'POST', token, body: { company_name: companyName, created_by: userId } }),
  deleteCompany: (token, id) => request(`/companies/${id}`, { method: 'DELETE', token }),

  listAccounts: (token, companyId) => request(`/accounts?company_id=${companyId}`, { token }),
  createAccount: (token, { companyId, accountType, balance, userId }) =>
    request('/accounts', {
      method: 'POST',
      token,
      body: { company_id: companyId, account_type: accountType, current_balance: balance, created_by: userId },
    }),
  deleteAccount: (token, id) => request(`/accounts/${id}`, { method: 'DELETE', token }),

  listTransfers: (token, companyId) => request(`/transfers?company_id=${companyId}`, { token }),
  createTransfer: (token, { companyId, transferType, fromAccountId, toAccountId, amount, notes, userId }) =>
    request('/transfers', {
      method: 'POST',
      token,
      body: {
        company_id: companyId,
        transfer_type: transferType,
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount,
        transfer_notes: notes || null,
        created_by_user: userId,
      },
    }),
  searchTransfers: (token, companyId, query) =>
    request('/transfers/search', { method: 'POST', token, body: { company_id: companyId, query } }),

  getSummary: (token, companyId) => request(`/companies/${companyId}/transfers/summary`, { token }),
  getInsights: (token, companyId) => request(`/companies/${companyId}/insights`, { token }),

  listMembers: (token, companyId) => request(`/companies/${companyId}/members`, { token }),
  addMember: (token, companyId, email) =>
    request(`/companies/${companyId}/members`, { method: 'POST', token, body: { email } }),
}

export const ACCOUNT_TYPES = ['BANK', 'CASH']
export const TRANSFER_TYPES = [
  'CASH DEPOSIT IN BANK',
  'CASH WITHDRAWAL FROM BANK',
  'BANK TO BANK TRANSFER',
  'CASH ACCOUNT TRANSFER',
]
export const STATUS_COLORS = {
  PENDING: '#8C6A1F',
  PROCESSING: '#8C6A1F',
  COMPLETED: '#33513F',
  FAILED: '#7C2D2D',
  CANCELLED: '#7C2D2D',
  REVERSED: '#7C2D2D',
}
