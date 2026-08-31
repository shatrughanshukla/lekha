import { useState, useEffect, useMemo } from 'react'
import { api, ACCOUNT_TYPES, STATUS_COLORS } from '../api.js'
import {
  Money, StampBadge, ErrorNote, DeleteButton, CopyableID,
  IconBank, IconCash, IconPlus, IconSparkle, IconSearch, IconArrowRight,
  IconPeople, IconInfo, IconCrown,
} from './Shared.jsx'
import TransferDetail from './TransferDetail.jsx'
import { getCached, setCached } from '../cache.js'
import { useT } from '../i18n.jsx'

// Mirrors lowBalanceThreshold in the backend — display text only. The
// actual suggestion decision always comes from the server (a.suggested_action).
const lowBalanceThreshold = 1000

export default function CompanyView({ token, user, company, onBack }) {
  const { t, tType, tAccountType, dateLocale } = useT()
  const [accounts, setAccounts] = useState(() => getCached(`company:${company.id}:accounts`) ?? [])
  const [myAccounts, setMyAccounts] = useState(() => getCached('my-accounts') ?? []) // across ALL companies user belongs to
  const [transfers, setTransfers] = useState(() => getCached(`company:${company.id}:transfers`) ?? [])
  const [members, setMembers] = useState(() => getCached(`company:${company.id}:members`) ?? [])
  const [error, setError] = useState('')

  const [invitingMember, setInvitingMember] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [detailTransferId, setDetailTransferId] = useState(null)

  const [addingAccount, setAddingAccount] = useState(false)
  const [accType, setAccType] = useState(ACCOUNT_TYPES[0])
  const [accBalance, setAccBalance] = useState('')

  const [fromAcc, setFromAcc] = useState('')
  const [toAcc, setToAcc] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Stale-while-revalidate: renders whatever's cached (if anything)
  // instantly, then this quietly fetches the real thing and updates both
  // the on-screen state and the cache for next time.
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
      setCached(`company:${company.id}:accounts`, a)
      setCached(`company:${company.id}:transfers`, t)
      setCached(`company:${company.id}:members`, m)
      setCached('my-accounts', mine)
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

  // Admin-only — the backend enforces this too, this is just so the button
  // doesn't sit there promising an action a non-admin can't actually take.
  async function toggleAccountActive(id, nextActive) {
    setError('')
    try {
      await api.updateAccount(token, id, { isActive: nextActive, userId: user.id })
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
  const isAdmin = useMemo(() => members.find((m) => m.user_id === user.id)?.is_admin ?? false, [members, user.id])

  // Preview-only mirror of deriveTransferType in the backend — the actual
  // value that gets recorded is always computed server-side from the real
  // account rows, this is purely so the form can show what will happen
  // before the user hits Send. Falls back to null (no preview shown) when
  // the "to" account isn't one we recognize locally, e.g. a pasted ID
  // belonging to someone else's company.
  const derivedTypeLabel = useMemo(() => {
    const fromType = accounts.find((a) => a.id === fromAcc)?.account_type
    const toType = accountsById[toAcc]?.account_type
    if (!fromType || !toType) return null
    const labels = {
      'BANK-BANK': t('transfer_type_BANK_TO_BANK'),
      'CASH-BANK': t('transfer_type_CASH_DEPOSIT'),
      'BANK-CASH': t('transfer_type_CASH_WITHDRAWAL'),
      'CASH-CASH': t('transfer_type_CASH_ACCOUNT'),
    }
    return labels[`${fromType}-${toType}`]
  }, [fromAcc, toAcc, accounts, accountsById, t])

  return (
    <div className="page">
      <button className="back-link" onClick={onBack}>
        {t('all_companies_back')}
      </button>

      {/* ---------------- Statement header ---------------- */}
      <div className="statement-header">
        <h1 className="page-title">{company.company_name}</h1>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">{t('balance')}</span>
            <span className="stat-value mono">
              <Money value={stats.totalBalance} />
            </span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-label">{t('accounts_title')}</span>
            <span className="stat-value mono">{t('active_of', { active: stats.activeCount, total: stats.accountCount })}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat">
            <span className="stat-label">{t('transfers_title')}</span>
            <span className="stat-value mono">{stats.transferCount}</span>
          </div>
        </div>
      </div>

      <ErrorNote message={error} />

      {/* ---------------- Members ---------------- */}
      <section className="panel">
        <div className="panel-head">
          <h2><IconPeople /> {t('members_title')}</h2>
          {iAmAdmin && !invitingMember && (
            <button className="btn-ghost small" onClick={() => setInvitingMember(true)}>
              {t('add_member')}
            </button>
          )}
        </div>

        <div className="member-row">
          {members.map((m) => (
            <div key={m.user_id} className="member-chip">
              <MemberAvatar member={m} />
              <span className="member-name" title={m.name}>{m.name}</span>
              <span className="member-email mono dim" title={m.email}>{m.email}</span>
              {iAmAdmin && (
                <div className="member-actions">
                  <button
                    className="link-btn small"
                    onClick={() => toggleAdmin(m.user_id, !m.is_admin)}
                  >
                    {m.is_admin ? t('demote') : t('make_admin')}
                  </button>
                  <DeleteButton onConfirm={() => removeMember(m.user_id)} labelKey="delete_member_label" />
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
            <button type="submit" className="btn-primary small">{t('add')}</button>
            <button type="button" className="btn-ghost small" onClick={() => setInvitingMember(false)}>{t('cancel')}</button>
          </form>
        )}
        <p className="panel-hint">
          {iAmAdmin ? t('admin_hint') : t('member_hint')}
        </p>
      </section>

      {/* ---------------- Overview: insights + search side by side ---------------- */}
      <div className="overview-row">
        <section className="panel">
          <div className="panel-head">
            <h2><IconSparkle /> {t('insights_title')}</h2>
            <button className="btn-ghost small" onClick={loadInsights} disabled={insightsLoading}>
              {insightsLoading ? t('thinking') : insights ? t('refresh') : t('generate')}
            </button>
          </div>
          {insights ? (
            <p className="insight-text">
              {insights.insight}
              {insights.cached && <span className="cached-hint" title={t('cached_hint_title')}>{t('cached_label')}</span>}
            </p>
          ) : (
            <p className="panel-hint">{t('company_insight_hint')}</p>
          )}
        </section>

        <section className="panel">
          <h2><IconSearch /> {t('search_transfers')}</h2>
          <form className="inline-form" onSubmit={runSearch}>
            <input
              placeholder={t('search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn-primary small" type="submit" disabled={searching || !searchQuery}>
              {searching ? '…' : t('search_btn')}
            </button>
          </form>
          {searchResults && (
            <div className="interpreted">
              {t('interpreted')}{' '}
              {Object.entries(searchResults.interpreted_filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || t('no_filters')}
              {' · '}
              <button className="link-btn" onClick={() => { setSearchResults(null); setSearchQuery('') }}>{t('clear')}</button>
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Accounts ---------------- */}
      <section className="panel">
        <h2>{t('accounts_title')}</h2>
        <div className="account-row">
          {accounts.map((a) => (
            <div key={a.id} className={`account-chip type-${a.account_type.toLowerCase()}`}>
              <div className="account-chip-top">
                {a.account_type === 'BANK' ? <IconBank /> : <IconCash />}
                <DeleteButton onConfirm={() => removeAccount(a.id)} labelKey="delete_account_label" />
              </div>
              <div className="account-chip-type">{tAccountType(a.account_type)}</div>
              <div className="account-chip-balance"><Money value={a.current_balance} /></div>
              <CopyableID id={a.id} className="account-chip-id" />
              <div className="account-chip-status-row">
                <div className={a.is_active ? 'pill pill-active' : 'pill pill-inactive'}>
                  {a.is_active ? t('active_pill') : t('inactive_pill')}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    className="link-btn small"
                    onClick={() => toggleAccountActive(a.id, !a.is_active)}
                  >
                    {a.is_active ? t('deactivate') : t('reactivate')}
                  </button>
                )}
              </div>
              {a.suggested_action && (
                <p className="account-suggestion">
                  {a.suggested_action === 'deactivate'
                    ? t('low_balance_suggestion', { n: lowBalanceThreshold.toLocaleString() })
                    : t('recovered_suggestion')}
                  {isAdmin && (
                    <button
                      type="button"
                      className="link-btn small"
                      onClick={() => toggleAccountActive(a.id, a.suggested_action === 'reactivate')}
                    >
                      {a.suggested_action === 'deactivate' ? t('deactivate_now') : t('reactivate_now')}
                    </button>
                  )}
                </p>
              )}
            </div>
          ))}

          {addingAccount ? (
            <form className="account-chip new-chip-form" onSubmit={createAccount}>
              <select value={accType} onChange={(e) => setAccType(e.target.value)}>
                {ACCOUNT_TYPES.map((ty) => <option key={ty} value={ty}>{tAccountType(ty)}</option>)}
              </select>
              <input
                type="number"
                placeholder={t('balance_placeholder')}
                value={accBalance}
                onChange={(e) => setAccBalance(e.target.value)}
              />
              <div className="new-card-actions">
                <button type="submit" className="btn-primary small">{t('open_btn')}</button>
                <button type="button" className="btn-ghost small" onClick={() => setAddingAccount(false)}>{t('cancel')}</button>
              </div>
            </form>
          ) : (
            <button className="account-chip new-chip" onClick={() => setAddingAccount(true)}>
              <IconPlus />
              <span>{t('new_account')}</span>
            </button>
          )}
        </div>
      </section>

      {/* ---------------- Transfers ---------------- */}
      <section className="panel">
        <h2>{t('transfers_title')}</h2>
        <form className="inline-form wrap" onSubmit={createTransfer}>
          <select value={fromAcc} onChange={(e) => setFromAcc(e.target.value)} required>
            <option value="">{t('from_placeholder')}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {tAccountType(a.account_type)} {a.id.slice(0, 6)}
              </option>
            ))}
          </select>
          <input
            className="mono"
            list="my-accounts-datalist"
            placeholder={t('to_placeholder')}
            value={toAcc}
            onChange={(e) => setToAcc(e.target.value)}
            required
          />
          <datalist id="my-accounts-datalist">
            {myAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company_name} — {tAccountType(a.account_type)}
              </option>
            ))}
          </datalist>
          <input type="number" placeholder={t('amount_placeholder')} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <input placeholder={t('note_placeholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button className="btn-primary small" type="submit">{t('send')}</button>
        </form>
        <p className="panel-hint">
          {derivedTypeLabel
            ? (() => {
                const [before, after] = t('will_be_recorded', { type: '\u0000' }).split('\u0000')
                return <>{before}<strong>{derivedTypeLabel}</strong>{after}</>
              })()
            : t('type_auto_detect_hint')}
        </p>

        {shownTransfers.length === 0 ? (
          <div className="empty-state">{t('no_transfers')}</div>
        ) : (
          <div className="ledger-table">
            <div className="ledger-table-head">
              <span>{t('col_date')}</span>
              <span>{t('col_type')}</span>
              <span>{t('col_route')}</span>
              <span>{t('col_status')}</span>
              <span className="align-right">{t('col_amount')}</span>
              <span></span>
            </div>
            {shownTransfers.map((t2) => {
              // Prefer the enriched fields the backend joins in; fall back to
              // the local myAccounts lookup (needed for search results,
              // which don't carry the enriched fields yet), then to a raw
              // short ID if the account belongs to someone else entirely.
              const fromLocal = accountsById[t2.from_account_id]
              const toLocal = accountsById[t2.to_account_id]
              const fromLabel = t2.from_company_name
                ? `${t2.from_company_name} · ${tAccountType(t2.from_account_type)}`
                : fromLocal
                ? `${fromLocal.company_name} · ${tAccountType(fromLocal.account_type)}`
                : t2.from_account_id.slice(0, 6)
              const toLabel = t2.to_company_name
                ? `${t2.to_company_name} · ${tAccountType(t2.to_account_type)}`
                : toLocal
                ? `${toLocal.company_name} · ${tAccountType(toLocal.account_type)}`
                : t2.to_account_id.slice(0, 6)

              return (
                <div key={t2.id} className="ledger-table-row clickable" onClick={() => setDetailTransferId(t2.id)}>
                  <span className="mono dim">{new Date(t2.transaction_date).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}</span>
                  <span>
                    {tType(t2.transfer_type)}
                    {t2.transfer_notes && <div className="note-preview">"{t2.transfer_notes}"</div>}
                  </span>
                  <span className="route mono dim">
                    <span className="route-part" title={fromLabel}>{fromLabel}</span>
                    <IconArrowRight width={13} height={13} />
                    <span className="route-part" title={toLabel}>{toLabel}</span>
                  </span>
                  <span>
                    <StampBadge status={t2.status} color={STATUS_COLORS[t2.status]} />
                    {t2.pending_status && <span className="pending-proposal-hint" title={t('pending_proposed_title')}>{t('proposed_label')}</span>}
                  </span>
                  <span className="align-right"><Money value={t2.amount} /></span>
                  <button
                    className="info-btn"
                    title={t('view_details_title')}
                    onClick={(e) => { e.stopPropagation(); setDetailTransferId(t2.id) }}
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
          company={company}
          transferId={detailTransferId}
          onClose={() => setDetailTransferId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

// Shows the member's photo if one is set and actually loads; falls back to
// their initial letter otherwise — including if the URL 404s or the image
// fails to load for any reason, rather than showing a broken-image icon.
function MemberAvatar({ member }) {
  const [broken, setBroken] = useState(false)
  const { t } = useT()
  const showImage = member.profile_picture_url && !broken

  return (
    <div className="member-avatar">
      <div className="member-avatar-clip">
        {showImage ? (
          <img
            src={member.profile_picture_url}
            alt={member.name}
            className="member-avatar-img"
            onError={() => setBroken(true)}
          />
        ) : (
          member.name?.[0]?.toUpperCase() || '?'
        )}
      </div>
      {member.is_admin && (
        <span className="member-crown" title={t('admin_title')}>
          <IconCrown width={10} height={10} />
        </span>
      )}
    </div>
  )
}
