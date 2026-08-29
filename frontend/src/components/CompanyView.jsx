import { useState, useEffect, useMemo } from 'react'
import { api, ACCOUNT_TYPES, TRANSFER_TYPES, STATUS_COLORS } from '../api.js'
import {
  Money, StampBadge, ErrorNote, DeleteButton,
  IconBank, IconCash, IconPlus, IconSparkle, IconSearch, IconArrowRight,
  IconPeople, IconInfo, IconCrown,
} from './Shared.jsx'
import TransferDetail from './TransferDetail.jsx'

export default function CompanyView({ token, user, company, onBack }) {
  const [accounts, setAccounts] = useState([])
  const [myAccounts, setMyAccounts] = useState([]) // across ALL companies user belongs to
  const [transfers, setTransfers] = useState([])
  const [members, setMembers] = useState([])
  const [error, setError] = useState('')

  const [invitingMember, setInvitingMember] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [detailTransferId, setDetailTransferId] = useState(null)

  const [addingAccount, setAddingAccount] = useState(false)
  const [accType, setAccType] = useState(ACCOUNT_TYPES[0])
  const [accBalance, setAccBalance] = useState('')

  const [xferType, setXferType] = useState(TRANSFER_TYPES[2])
  const [fromAcc, setFromAcc] = useState('')
  const [toAcc, setToAcc] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  async function refresh() {
    try {
      const [a, t, m, mine] = await Promise.all([
        api.listAccounts(token, company.id),
        api.listTransfers(token, company.id),
        api.listMembers(token, company.id),
        api.listMyAccounts(token),
      ])
      setAccounts(a)
      setTransfers(t)
      setMembers(m)
      setMyAccounts(mine)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id])

  async function addMember(e) {
    e.preventDefault()
    setError('')
    try {
      await api.addMember(token, company.id, inviteEmail)
      setInviteEmail('')
      setInvitingMember(false)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeMember(userId) {
    setError('')
    try {
      await api.removeMember(token, company.id, userId)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleAdmin(userId, makeAdmin) {
    setError('')
    try {
      await api.updateMemberRole(token, company.id, userId, makeAdmin)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const myMembership = members.find((m) => m.user_id === user.id)
  const iAmAdmin = myMembership?.is_admin || false

  const stats = useMemo(() => {
    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
    const activeCount = accounts.filter((a) => a.is_active).length
    return { totalBalance, activeCount, accountCount: accounts.length, transferCount: transfers.length }
  }, [accounts, transfers])

  async function createAccount(e) {
    e.preventDefault()
    setError('')
    try {
      await api.createAccount(token, {
        companyId: company.id,
        accountType: accType,
        balance: Number(accBalance) || 0,
        userId: user.id,
      })
      setAccBalance('')
      setAddingAccount(false)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeAccount(id) {
    setError('')
    try {
      await api.deleteAccount(token, id)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function createTransfer(e) {
    e.preventDefault()
    setError('')
    try {
      await api.createTransfer(token, {
        transferType: xferType,
        fromAccountId: fromAcc,
        toAccountId: toAcc,
        amount: Number(amount),
        notes,
        userId: user.id,
      })
      setToAcc('')
      setAmount('')
      setNotes('')
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  async function runSearch(e) {
    e.preventDefault()
    setSearching(true)
    setError('')
    try {
      setSearchResults(await api.searchTransfers(token, company.id, searchQuery))
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function loadInsights() {
    setInsightsLoading(true)
    setError('')
    try {
      setInsights(await api.getInsights(token, company.id))
    } catch (err) {
      setError(err.message)
    } finally {
      setInsightsLoading(false)
    }
  }

  const shownTransfers = searchResults ? searchResults.results : transfers
  const accountsById = useMemo(() => Object.fromEntries(myAccounts.map((a) => [a.id, a])), [myAccounts])

  return (
    <div className="page">
      <button className="back-link" onClick={onBack}>
        ← All companies
      </button>

      {/* ---------------- Statement header ---------------- */}
      <div className="statement-header">
        <h1 className="page-title">{company.company_name}</h1>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Balance</span>
            <span className="stat-value mono">
              <Money value={stats.totalBalance} />
            </span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-label">Accounts</span>
            <span className="stat-value mono">{stats.activeCount}/{stats.accountCount} active</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-label">Transfers</span>
            <span className="stat-value mono">{stats.transferCount}</span>
          </div>
        </div>
      </div>

      <ErrorNote message={error} />

      {/* ---------------- Members ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2><IconPeople /> Members</h2>
          {iAmAdmin && !invitingMember && (
            <button className="btn-ghost small" onClick={() => setInvitingMember(true)}>
              + Add member
            </button>
          )}
        </div>

        <div className="member-row">
          {members.map((m) => (
            <div key={m.user_id} className="member-chip">
              <div className="member-avatar">
                {m.name?.[0]?.toUpperCase() || '?'}
                {m.is_admin && (
                  <span className="member-crown" title="Admin">
                    <IconCrown width={10} height={10} />
                  </span>
                )}
              </div>
              <span className="member-name" title={m.name}>{m.name}</span>
              <span className="member-email mono dim" title={m.email}>{m.email}</span>
              {iAmAdmin && (
                <div className="member-actions">
                  <button
                    className="link-btn small"
                    onClick={() => toggleAdmin(m.user_id, !m.is_admin)}
                  >
                    {m.is_admin ? 'demote' : 'make admin'}
                  </button>
                  <DeleteButton onConfirm={() => removeMember(m.user_id)} label="member" />
                </div>
              )}
            </div>
          ))}
        </div>

        {invitingMember && (
          <form className="inline-form" onSubmit={addMember}>
            <input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              autoFocus
            />
            <button type="submit" className="btn-primary small">Add</button>
            <button type="button" className="btn-ghost small" onClick={() => setInvitingMember(false)}>Cancel</button>
          </form>
        )}
        <p className="panel-hint">
          {iAmAdmin
            ? 'You\'re an admin — you can add, remove, and promote members. A company always needs at least one admin.'
            : 'Only people added here can see this company. Ask an admin to add or remove members.'}
        </p>
      </section>

      {/* ---------------- Overview: insights + search side by side ---------------- */}
      <div className="overview-row">
        <section className="panel">
          <div className="panel-head">
            <h2><IconSparkle /> Insights</h2>
            <button className="btn-ghost small" onClick={loadInsights} disabled={insightsLoading}>
              {insightsLoading ? 'Thinking…' : insights ? 'Refresh' : 'Generate'}
            </button>
          </div>
          {insights ? (
            <p className="insight-text">{insights.insight}</p>
          ) : (
            <p className="panel-hint">AI-written summary of this company's transfer activity, from real computed numbers.</p>
          )}
        </section>

        <section className="panel">
          <h2><IconSearch /> Search transfers</h2>
          <form className="inline-form" onSubmit={runSearch}>
            <input
              placeholder='"completed transfers over 100"'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn-primary small" type="submit" disabled={searching || !searchQuery}>
              {searching ? '…' : 'Search'}
            </button>
          </form>
          {searchResults && (
            <div className="interpreted">
              interpreted:{' '}
              {Object.entries(searchResults.interpreted_filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'no filters'}
              {' · '}
              <button className="link-btn" onClick={() => { setSearchResults(null); setSearchQuery('') }}>clear</button>
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Accounts ---------------- */}
      <section className="panel">
        <h2>Accounts</h2>
        <div className="account-row">
          {accounts.map((a) => (
            <div key={a.id} className={`account-chip type-${a.account_type.toLowerCase()}`}>
              <div className="account-chip-top">
                {a.account_type === 'BANK' ? <IconBank /> : <IconCash />}
                <DeleteButton onConfirm={() => removeAccount(a.id)} label="account" />
              </div>
              <div className="account-chip-type">{a.account_type}</div>
              <div className="account-chip-balance"><Money value={a.current_balance} /></div>
              <button
                type="button"
                className="account-chip-id mono"
                title="Click to copy account ID"
                onClick={() => navigator.clipboard.writeText(a.id)}
              >
                {a.id.slice(0, 8)}… ⧉
              </button>
              <div className={a.is_active ? 'pill pill-active' : 'pill pill-inactive'}>
                {a.is_active ? 'active' : 'inactive'}
              </div>
            </div>
          ))}

          {addingAccount ? (
            <form className="account-chip new-chip-form" onSubmit={createAccount}>
              <select value={accType} onChange={(e) => setAccType(e.target.value)}>
                {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input
                type="number"
                placeholder="Balance"
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
              />
              <div className="new-card-actions">
                <button type="submit" className="btn-primary small">Open</button>
                <button type="button" className="btn-ghost small" onClick={() => setAddingAccount(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button className="account-chip new-chip" onClick={() => setAddingAccount(true)}>
              <IconPlus />
              <span>New account</span>
            </button>
          )}
        </div>
      </section>

      {/* ---------------- Transfers ---------------- */}
      <section className="panel">
        <h2>Transfers</h2>
        <form className="inline-form wrap" onSubmit={createTransfer}>
          <select value={xferType} onChange={(e) => setXferType(e.target.value)}>
            {TRANSFER_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={fromAcc} onChange={(e) => setFromAcc(e.target.value)} required>
            <option value="">from…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_type} {a.id.slice(0, 6)}
              </option>
            ))}
          </select>
          <input
            className="mono"
            list="my-accounts-datalist"
            placeholder="to: paste account ID…"
            value={toAcc}
            onChange={(e) => setToAcc(e.target.value)}
            required
          />
          <datalist id="my-accounts-datalist">
            {myAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company_name} — {a.account_type}
              </option>
            ))}
          </datalist>
          <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-primary small" type="submit">Send</button>
        </form>

        {shownTransfers.length === 0 ? (
          <div className="empty-state">No transfers to show.</div>
        ) : (
          <div className="ledger-table">
            <div className="ledger-table-head">
              <span>Date</span>
              <span>Type</span>
              <span>Route</span>
              <span>Status</span>
              <span className="align-right">Amount</span>
              <span></span>
            </div>
            {shownTransfers.map((t) => {
              // Prefer the enriched fields the backend joins in; fall back to
              // the local myAccounts lookup (needed for search results,
              // which don't carry the enriched fields yet), then to a raw
              // short ID if the account belongs to someone else entirely.
              const fromLocal = accountsById[t.from_account_id]
              const toLocal = accountsById[t.to_account_id]
              const fromLabel = t.from_company_name
                ? `${t.from_company_name} · ${t.from_account_type}`
                : fromLocal
                ? `${fromLocal.company_name} · ${fromLocal.account_type}`
                : t.from_account_id.slice(0, 6)
              const toLabel = t.to_company_name
                ? `${t.to_company_name} · ${t.to_account_type}`
                : toLocal
                ? `${toLocal.company_name} · ${toLocal.account_type}`
                : t.to_account_id.slice(0, 6)

              return (
                <div key={t.id} className="ledger-table-row clickable" onClick={() => setDetailTransferId(t.id)}>
                  <span className="mono dim">{new Date(t.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <span>
                    {t.transfer_type}
                    {t.transfer_notes && <div className="note-preview">"{t.transfer_notes}"</div>}
                  </span>
                  <span className="route mono dim">
                    <span className="route-part" title={fromLabel}>{fromLabel}</span>
                    <IconArrowRight width={13} height={13} />
                    <span className="route-part" title={toLabel}>{toLabel}</span>
                  </span>
                  <StampBadge status={t.status} color={STATUS_COLORS[t.status]} />
                  <span className="align-right"><Money value={t.amount} /></span>
                  <button
                    className="info-btn"
                    title="View details"
                    onClick={(e) => { e.stopPropagation(); setDetailTransferId(t.id) }}
                  >
                    <IconInfo width={15} height={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {detailTransferId && (
        <TransferDetail
          token={token}
          user={user}
          transferId={detailTransferId}
          onClose={() => setDetailTransferId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}
