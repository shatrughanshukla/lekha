import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, STATUS_COLORS } from '../api.js'
import {
  ErrorNote, Money, StampBadge, IconSearch, IconPlus, IconBuilding, IconArrowRight,
  IconTrash, IconPencil, IconClose, IconWallet, IconSwap, IconGrid, IconClock, IconBolt, IconCheck,
} from './Shared.jsx'
import { getCached, setCached } from '../cache.js'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'
import InsightsCard from './InsightsCard.jsx'
import EmptyState from './EmptyState.jsx'
import DropdownMenu from './DropdownMenu.jsx'
import CompanyActionDialog from './CompanyActionDialog.jsx'
import { SkeletonLine, SkeletonCard } from './Skeleton.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { useMotionVariants, listVariants, listItemVariants, staticCardVariants, buttonVariants } from '../motion/index.js'

const DAY_MS = 24 * 60 * 60 * 1000
const AVATAR_PALETTE = ['var(--color-primary)', 'var(--chart-income)', 'var(--color-warning)', 'var(--chart-trend)', 'var(--color-reversed)', 'var(--chart-volume)']

function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'greeting_morning'
  if (h < 18) return 'greeting_afternoon'
  return 'greeting_evening'
}

/** % change vs the prior period of equal length. Returns null when there's
 * nothing to meaningfully compare against (avoids "+Infinity%" off a zero
 * baseline) — callers show the plain count instead of a delta in that case. */
function periodDelta(current, previous) {
  if (previous === 0) return current > 0 ? 'new' : null
  return Math.round(((current - previous) / previous) * 100)
}

function KPI({ label, value, delta, icon, warn }) {
  const deltaText = delta === 'new' ? '—' : delta === null ? null : `${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)}%`
  return (
    <div className="kpi-tile">
      <span className="kpi-tile-icon">{icon}</span>
      <div className="kpi-tile-body">
        <span className={`kpi-tile-value mono${warn ? ' hero-stat-warning' : ''}`}>{value}</span>
        <span className="kpi-tile-label">{label}</span>
      </div>
      {deltaText && (
        <span className={`kpi-tile-delta${delta !== 'new' && delta < 0 ? ' kpi-delta-down' : ''}`}>{deltaText}</span>
      )}
    </div>
  )
}

/** Tiny 7-bar sparkline built from real per-day counts — no chart library,
 * just proportional div heights. Used both for the balance panel's weekly
 * volume and each company row's mini activity bars. */
function MiniBars({ values, height = 28 }) {
  const max = Math.max(1, ...values)
  return (
    <div className="mini-bars" style={{ height }}>
      {values.map((v, i) => (
        <span key={i} className="mini-bar" style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

export default function Dashboard({ token, user, onOpenCompany }) {
  const [companies, setCompanies] = useState(() => getCached('companies') ?? [])
  const [accounts, setAccounts] = useState(() => getCached('my-accounts') ?? [])
  const [transfers, setTransfers] = useState(() => getCached('all-transfers') ?? [])
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  // { mode: 'rename' | 'delete', company } while the password dialog is open
  const [companyDialog, setCompanyDialog] = useState(null)
  const [loading, setLoading] = useState(() => !getCached('companies'))
  const [period, setPeriod] = useState(7) // days — drives KPI deltas only
  const [commandHintDismissed, setCommandHintDismissed] = useState(() => localStorage.getItem('lekha_command_hint_dismissed') === '1')
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsFetchedAt, setInsightsFetchedAt] = useState(null)
  const { t, tType, dateLocale } = useT()
  const navigate = useNavigate()
  const listVars = useMotionVariants(listVariants)
  const rowVars = useMotionVariants(listItemVariants)
  const heroVars = useMotionVariants(staticCardVariants)
  const btnVars = useMotionVariants(buttonVariants)

  async function refresh() {
    if (!getCached('companies')) setLoading(true)
    try {
      const [companyData, accountData, transferData] = await Promise.all([
        api.listCompanies(token),
        api.listMyAccounts(token),
        api.listAllTransfers(token),
      ])
      setCompanies(companyData)
      setAccounts(accountData)
      setTransfers(transferData)
      setCached('companies', companyData)
      setCached('my-accounts', accountData)
      setCached('all-transfers', transferData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadInsights() {
    setInsightsLoading(true)
    try {
      const data = await api.getOverviewInsights(token)
      setInsights(data)
      setInsightsFetchedAt(Date.now())
    } catch (err) {
      setError(err.message)
    } finally {
      setInsightsLoading(false)
    }
  }

  async function createCompany(e) {
    e.preventDefault()
    setError('')
    try {
      await api.createCompany(token, newName, user.id)
      setNewName('')
      setCreating(false)
      refresh()
    } catch (err) {
      setError(err.message)
    }
  }

  const shown = useMemo(
    () => companies.filter((c) => c.company_name.toLowerCase().includes(filter.toLowerCase())),
    [companies, filter],
  )

  const companyById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies])

  // ---- everything below is derived from the three arrays above; nothing
  // here is a separate request, and nothing is invented. ----
  const derived = useMemo(() => {
    const now = Date.now()
    const periodStart = now - period * DAY_MS
    const priorStart = now - 2 * period * DAY_MS

    const inPeriod = (iso) => { const t2 = new Date(iso).getTime(); return t2 >= periodStart }
    const inPrior = (iso) => { const t2 = new Date(iso).getTime(); return t2 >= priorStart && t2 < periodStart }

    const companyStats = new Map()
    for (const c of companies) {
      companyStats.set(c.id, { accountCount: 0, activeAccountCount: 0, balance: 0, transferCount: 0, pending: 0, dayBuckets: Array(7).fill(0) })
    }
    for (const a of accounts) {
      const b = companyStats.get(a.company_id)
      if (!b) continue
      b.accountCount += 1
      b.balance += Number(a.current_balance)
      if (a.is_active) b.activeAccountCount += 1
    }
    let transfersInPeriod = 0
    let transfersInPrior = 0
    for (const tr of transfers) {
      const b = companyStats.get(tr.company_id)
      if (b) {
        b.transferCount += 1
        if (tr.status === 'PENDING') b.pending += 1
        const daysAgo = Math.floor((now - new Date(tr.transaction_date).getTime()) / DAY_MS)
        if (daysAgo >= 0 && daysAgo < 7) b.dayBuckets[6 - daysAgo] += 1
      }
      if (inPeriod(tr.transaction_date)) transfersInPeriod += 1
      else if (inPrior(tr.transaction_date)) transfersInPrior += 1
    }

    const accountsInPeriod = accounts.filter((a) => inPeriod(a.created_at)).length
    const accountsInPrior = accounts.filter((a) => inPrior(a.created_at)).length
    const companiesInPeriod = companies.filter((c) => inPeriod(c.created_at)).length
    const companiesInPrior = companies.filter((c) => inPrior(c.created_at)).length

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)
    const totalPending = transfers.filter((tr) => tr.status === 'PENDING').length

    // 7-day system-wide volume, for the balance panel's sparkline.
    const weekBuckets = Array(7).fill(0)
    for (const tr of transfers) {
      const daysAgo = Math.floor((now - new Date(tr.transaction_date).getTime()) / DAY_MS)
      if (daysAgo >= 0 && daysAgo < 7) weekBuckets[6 - daysAgo] += 1
    }

    // Recent activity: last 6 transfers system-wide, real fields only.
    const recentActivity = [...transfers]
      .sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
      .slice(0, 6)
      .map((tr) => ({ ...tr, companyName: companyById[tr.company_id]?.company_name || tr.from_company_name || tr.to_company_name || '—' }))

    // Most active company in the period (by transfer count) — only surfaced
    // as a finding when there's an actual leader among more than one company.
    let mostActive = null
    if (companies.length > 1) {
      let best = null
      for (const [id, s] of companyStats) {
        if (s.transferCount > 0 && (!best || s.transferCount > best.transferCount)) best = { id, transferCount: s.transferCount }
      }
      if (best) {
        mostActive = {
          name: companyById[best.id]?.company_name,
          share: transfersInPeriod > 0 ? Math.round((best.transferCount / transfers.length) * 100) : null,
        }
      }
    }

    // ---- Needs attention: three real, click-through categories. ----
    // "My accounts" = every account across every company I belong to
    // (`accounts` here — already fetched, unrelated to which side of a
    // given transfer it's on). Used to tell whether a transfer is
    // incoming to me specifically, not just present somewhere in the feed.
    const myAccountIds = new Set(accounts.map((a) => a.id))

    // Approvals waiting on me: PENDING transfers where the receiving
    // account (to_account_id) is mine. RespondToTransfer on the backend
    // authorizes exactly this side (utils.IsCompanyMember(toCompanyID,...)),
    // so this mirrors the real authorization rule rather than guessing.
    const pendingApprovals = transfers.filter((tr) => tr.status === 'PENDING' && myAccountIds.has(tr.to_account_id))

    // Reversal requests waiting on me: a COMPLETED transfer with
    // pending_status === 'REVERSED' (the literal value the backend writes
    // when one side proposes a reversal) that touches one of my accounts,
    // proposed by a company that isn't one of mine.
    const reversalRequests = transfers.filter((tr) =>
      tr.status === 'COMPLETED' &&
      tr.pending_status === 'REVERSED' &&
      tr.proposed_by_company_id &&
      !companyById[tr.proposed_by_company_id] &&
      (myAccountIds.has(tr.from_account_id) || myAccountIds.has(tr.to_account_id))
    )

    // Account issues: the server's own suggested_action (deactivate a
    // long-dormant zero-balance account, or reactivate one that's picked
    // back up) — already computed and already shown per-account in
    // CompanyView; this just counts it across every company at once.
    const accountIssues = accounts.filter((a) => a.suggested_action)

    return {
      companyStats, totalBalance, totalPending, weekBuckets, recentActivity, mostActive,
      pendingApprovals, reversalRequests, accountIssues,
      kpi: {
        companies: { value: companies.length, delta: periodDelta(companiesInPeriod, companiesInPrior) },
        accounts: { value: accounts.length, delta: periodDelta(accountsInPeriod, accountsInPrior) },
        transfers: { value: transfers.length, delta: periodDelta(transfersInPeriod, transfersInPrior) },
        pending: { value: totalPending },
      },
      transfersInPeriod, transfersInPrior,
    }
  }, [companies, accounts, transfers, companyById, period])

  // Real, computed findings for the AI panel — not part of the LLM
  // response. See InsightsCard.jsx for why these are kept separate from
  // the model's free-text narrative rather than asking it to emit JSON.
  const findings = useMemo(() => {
    if (!insights) return []
    const list = []
    const { transfersInPeriod, transfersInPrior, totalPending, mostActive } = derived
    const volDelta = periodDelta(transfersInPeriod, transfersInPrior)
    if (volDelta !== null) {
      list.push({
        icon: volDelta === 'new' || volDelta >= 0 ? '↑' : '↓',
        label: volDelta === 'new'
          ? t('finding_volume_new')
          : t('finding_volume_change', { pct: Math.abs(volDelta), dir: volDelta >= 0 ? t('finding_up') : t('finding_down') }),
        sublabel: t('finding_volume_sub', { n: transfersInPeriod, prev: transfersInPrior }),
      })
    }
    list.push(
      totalPending === 0
        ? { icon: '–', label: t('finding_no_pending'), sublabel: t('finding_no_pending_sub') }
        : { icon: '!', label: t('finding_pending', { n: totalPending }), sublabel: t('finding_pending_sub') }
    )
    if (mostActive?.name && mostActive.share) {
      list.push({ icon: '●', label: t('finding_most_active', { name: mostActive.name }), sublabel: t('finding_most_active_sub', { pct: mostActive.share }) })
    }
    return list
  }, [insights, derived, t])

  return (
    <PageLayout restoreScroll padding="flush" className="dashboard-v2">
      {/* ---------------- Greeting ---------------- */}
      <motion.div className="dash-greeting" variants={heroVars} initial="initial" animate="animate">
        <div>
          <h1 className="page-title">{t(greetingKey(), { name: user.name?.split(' ')[0] || user.name })}</h1>
          <p className="page-sub">{t('dash_subgreeting')}</p>
        </div>
        <div className="dash-greeting-right">
          <span className="dash-date">{new Date().toLocaleDateString(dateLocale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <select className="period-select" value={period} onChange={(e) => setPeriod(Number(e.target.value))} aria-label={t('period_selector_label')}>
            <option value={7}>{t('period_7d')}</option>
            <option value={30}>{t('period_30d')}</option>
          </select>
        </div>
      </motion.div>

      <ErrorNote message={error} />

      {/* ---------------- KPI row ---------------- */}
      <div className="kpi-row">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div className="kpi-tile" key={i}><SkeletonLine width="60%" height={22} /></div>)
        ) : (
          <>
            <KPI label={t('hero_companies')} value={derived.kpi.companies.value} delta={derived.kpi.companies.delta} icon={<IconGrid />} />
            <KPI label={t('hero_accounts')} value={derived.kpi.accounts.value} delta={derived.kpi.accounts.delta} icon={<IconWallet />} />
            <KPI label={t('hero_transfers')} value={derived.kpi.transfers.value} delta={derived.kpi.transfers.delta} icon={<IconSwap />} />
            <KPI label={t('hero_pending')} value={derived.kpi.pending.value} delta={null} icon={<IconClock />} warn={derived.kpi.pending.value > 0} />
          </>
        )}
      </div>

      {/* ---------------- Balance + AI insight ---------------- */}
      <div className="dash-summary-row">
        <section className="panel balance-panel">
          <div className="panel-head">
            <h2>{t('total_balance')}</h2>
          </div>
          {loading ? (
            <SkeletonLine width="50%" height={32} />
          ) : (
            <>
              <div className="balance-figure mono"><Money value={derived.totalBalance} /></div>
              <div className="balance-subrow">
                <MiniBars values={derived.weekBuckets} />
                <span className="balance-subrow-label">{t('hero_recent_hint')}</span>
              </div>
            </>
          )}
        </section>

        <InsightsCard
          title={t('insights_title')}
          insights={insights}
          loading={insightsLoading}
          onGenerate={loadInsights}
          emptyHint={t('overview_insight_hint')}
          fetchedAt={insightsFetchedAt}
          findings={findings}
          compact
        />
      </div>

      {/* ---------------- Companies toolbar ---------------- */}
      <div className="section-toolbar">
        <h2>{t('your_companies')}</h2>
        <div className="section-toolbar-actions">
          <div className="search-box search-box-sm">
            <IconSearch />
            <input placeholder={t('filter_placeholder')} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <AnimatePresence>
              {filter && (
                <motion.button
                  className="search-clear-btn"
                  onClick={() => setFilter('')}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  aria-label={t('clear_search')}
                  type="button"
                >
                  <IconClose />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <motion.button
            className="btn-primary small"
            onClick={() => setCreating(true)}
            variants={btnVars}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <IconPlus /> {t('new_company')}
          </motion.button>
        </div>
      </div>

      {creating && (
        <motion.form
          className="new-company-inline-form"
          onSubmit={createCompany}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <input autoFocus placeholder={t('company_name_placeholder')} value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <button type="submit" className="btn-primary small">{t('create')}</button>
          <button type="button" className="btn-ghost small" onClick={() => setCreating(false)}>{t('cancel')}</button>
        </motion.form>
      )}

      {/* ---------------- Company rows ---------------- */}
      {loading ? (
        <div className="company-rows">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          icon={IconBuilding}
          title={t('no_companies_title')}
          hint={t('no_companies_hint')}
          action={<button className="btn-primary small" onClick={() => setCreating(true)}>{t('new_company')}</button>}
        />
      ) : shown.length === 0 && filter ? (
        <EmptyState
          icon={IconSearch}
          title={t('no_search_results_title')}
          hint={t('no_search_results_hint')}
          action={<button className="btn-ghost small" onClick={() => setFilter('')}>{t('clear_search')}</button>}
        />
      ) : (
        <motion.div className="company-rows" variants={listVars} initial="initial" animate="animate">
          <AnimatePresence mode="popLayout">
            {shown.map((c, i) => {
              const stat = derived.companyStats.get(c.id) || { accountCount: 0, activeAccountCount: 0, balance: 0, transferCount: 0, pending: 0, dayBuckets: [] }
              const active = stat.accountCount === 0 ? null : stat.activeAccountCount > 0
              return (
                <motion.div
                  key={c.id}
                  className="company-row"
                  layout
                  variants={rowVars}
                  initial="initial"
                  animate="animate"
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                  onClick={() => onOpenCompany(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onOpenCompany(c) }}
                >
                  <span className="company-row-avatar" style={{ background: `color-mix(in srgb, ${AVATAR_PALETTE[i % AVATAR_PALETTE.length]} 16%, transparent)`, color: AVATAR_PALETTE[i % AVATAR_PALETTE.length] }}>
                    {c.company_name[0]?.toUpperCase()}
                  </span>

                  <div className="company-row-name">
                    <span className="company-row-name-text">{c.company_name}</span>
                    <span className="company-row-date">
                      {t('opened_on', { date: new Date(c.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' }) })}
                    </span>
                  </div>

                  <div className="company-row-stat">
                    <span className="mono">₹{stat.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span className="company-row-stat-label">{t('balance')}</span>
                  </div>
                  <div className="company-row-stat">
                    <span className="mono">{stat.activeAccountCount}/{stat.accountCount}</span>
                    <span className="company-row-stat-label">{t('accounts_title')}</span>
                  </div>
                  <div className="company-row-stat">
                    <span className="mono">{stat.transferCount}</span>
                    <span className="company-row-stat-label">{t('transfers_title')}</span>
                  </div>

                  <MiniBars values={stat.dayBuckets} height={22} />

                  <div className="company-row-status">
                    {active === null ? (
                      <span className="status-dot status-dot-neutral" />
                    ) : (
                      <span className={`status-dot ${active ? 'status-dot-active' : 'status-dot-inactive'}`} />
                    )}
                    <div className="company-row-status-text">
                      <span>{active === null ? t('no_accounts') : active ? t('active_pill') : t('inactive_pill')}</span>
                      <span className="company-row-status-sub">
                        {stat.pending > 0 ? t('n_pending', { n: stat.pending }) : t('no_pending')}
                      </span>
                    </div>
                  </div>

                  {/* Rename/delete are admin-only (the backend enforces it too), so
                      non-admins get no menu rather than one full of dead items. */}
                  {c.is_admin && (
                    <DropdownMenu
                      trigger={<button className="icon-menu-btn company-row-menu" aria-label={t('company_menu_label')}>⋯</button>}
                      items={[
                        { label: t('company_rename'), icon: <IconPencil />, onSelect: () => setCompanyDialog({ mode: 'rename', company: c }) },
                        { label: t('company_delete'), icon: <IconTrash />, danger: true, onSelect: () => setCompanyDialog({ mode: 'delete', company: c }) },
                      ]}
                    />
                  )}

                  <IconArrowRight className="company-row-arrow" />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ---------------- Recent activity + Quick actions ---------------- */}
      <div className="dash-bottom-row">
        <section className="panel">
          <div className="panel-head">
            <h2><IconClock /> {t('recent_activity_title')}</h2>
          </div>
          {derived.recentActivity.length === 0 ? (
            <EmptyState icon={IconClock} title={t('no_recent_activity')} compact />
          ) : (
            <div className="activity-list">
              {derived.recentActivity.map((tr) => (
                <div className="activity-row" key={tr.id}>
                  <div className="activity-row-main">
                    <span className="activity-row-type">{tType(tr.transfer_type)}</span>
                    <span className="activity-row-meta">
                      {tr.companyName} · {new Date(tr.transaction_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}, {new Date(tr.transaction_date).toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="activity-row-right">
                    <span className="mono"><Money value={tr.amount} /></span>
                    <StampBadge status={tr.status} color={STATUS_COLORS[tr.status]} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2><IconBolt /> {t('needs_attention_title')}</h2>
          </div>
          {derived.pendingApprovals.length === 0 && derived.reversalRequests.length === 0 && derived.accountIssues.length === 0 ? (
            <EmptyState icon={IconCheck} title={t('all_caught_up')} hint={t('all_caught_up_hint')} compact />
          ) : (
            <div className="attention-list">
              {derived.pendingApprovals.length > 0 && (
                <button className="attention-row" onClick={() => navigate('/app/transfers')}>
                  <div className="attention-row-main">
                    <span className="attention-row-label">{t('n_pending_approvals', { n: derived.pendingApprovals.length, s: derived.pendingApprovals.length === 1 ? '' : 's' })}</span>
                    <span className="attention-row-sub">{t('pending_approvals_sub')}</span>
                  </div>
                  <IconArrowRight className="attention-row-arrow" />
                </button>
              )}
              {derived.reversalRequests.length > 0 && (
                <button className="attention-row" onClick={() => navigate('/app/transfers')}>
                  <div className="attention-row-main">
                    <span className="attention-row-label">{t('n_reversal_requests', { n: derived.reversalRequests.length, s: derived.reversalRequests.length === 1 ? '' : 's' })}</span>
                    <span className="attention-row-sub">{t('reversal_requests_sub')}</span>
                  </div>
                  <IconArrowRight className="attention-row-arrow" />
                </button>
              )}
              {derived.accountIssues.length > 0 ? (
                <button className="attention-row" onClick={() => navigate('/app/accounts')}>
                  <div className="attention-row-main">
                    <span className="attention-row-label">{t('n_account_issues', { n: derived.accountIssues.length, s: derived.accountIssues.length === 1 ? '' : 's' })}</span>
                    <span className="attention-row-sub">{t('account_issues_sub')}</span>
                  </div>
                  <IconArrowRight className="attention-row-arrow" />
                </button>
              ) : (
                <div className="attention-row attention-row-clear">
                  <div className="attention-row-main">
                    <span className="attention-row-label">{t('no_account_issues')}</span>
                    <span className="attention-row-sub">{t('no_account_issues_sub')}</span>
                  </div>
                  <IconCheck className="attention-row-check" />
                </div>
              )}
            </div>
          )}
          {!commandHintDismissed && (
            <div className="command-hint-row">
              <button className="command-hint-open" onClick={() => window.dispatchEvent(new Event('lekha:open-command-palette'))}>
                {t('command_hint_prefix')} <kbd>{t('command_hint_key')}</kbd> {t('command_hint_suffix')}
              </button>
              <button
                className="command-hint-dismiss"
                aria-label={t('dismiss')}
                onClick={() => { setCommandHintDismissed(true); localStorage.setItem('lekha_command_hint_dismissed', '1') }}
              >
                <IconClose />
              </button>
            </div>
          )}
        </section>
      </div>

      <CompanyActionDialog
        target={companyDialog}
        token={token}
        onClose={() => setCompanyDialog(null)}
        onDone={() => { setCompanyDialog(null); refresh() }}
      />
    </PageLayout>
  )
}
