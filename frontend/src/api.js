const BASE_URL = 'https://lekha-n0jx.onrender.com/api/v1'
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
  createTransfer: (token, { transferType, fromAccountId, toAccountId, amount, notes, userId }) =>
    request('/transfers', {
      method: 'POST',
      token,
      body: {
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
  getTransfer: (token, id) => request(`/transfers/${id}`, { token }),
  updateTransferStatus: (token, id, status, userId) =>
    request(`/transfers/${id}/status`, { method: 'PATCH', token, body: { status, updated_by_user: userId } }),

  getSummary: (token, companyId) => request(`/companies/${companyId}/transfers/summary`, { token }),
  getInsights: (token, companyId) => request(`/companies/${companyId}/insights`, { token }),

  listMembers: (token, companyId) => request(`/companies/${companyId}/members`, { token }),
  addMember: (token, companyId, email) =>
    request(`/companies/${companyId}/members`, { method: 'POST', token, body: { email } }),
  removeMember: (token, companyId, userId) =>
    request(`/companies/${companyId}/members/${userId}`, { method: 'DELETE', token }),
  updateMemberRole: (token, companyId, userId, isAdmin) =>
    request(`/companies/${companyId}/members/${userId}`, { method: 'PATCH', token, body: { is_admin: isAdmin } }),
}

export const TRANSFER_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REVERSED']

export const ACCOUNT_TYPES = ['BANK', 'CASH']
export const TRANSFER_TYPES = [
  'CASH DEPOSIT IN BANK',
  'CASH WITHDRAWAL FROM BANK',
  'BANK TO BANK TRANSFER',
  'CASH ACCOUNT TRANSFER',
]
export const STATUS_COLORS = {
  PENDING: '#ffb84d',
  PROCESSING: '#2dd4ff',
  COMPLETED: '#2af0c0',
  FAILED: '#ff4d6d',
  CANCELLED: '#8d92c2',
  REVERSED: '#c084fc',
}
