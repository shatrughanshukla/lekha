import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api, STATUS_COLORS } from '../api.js'
import { Money, ErrorNote, IconBuilding } from './Shared.jsx'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'
import InsightsCard from './InsightsCard.jsx'
import EmptyState from './EmptyState.jsx'
import { SkeletonLine } from './Skeleton.jsx'
import { motion } from 'framer-motion'
import { useMotionVariants, staticCardVariants, listVariants, listItemVariants, duration, easing } from '../motion/index.js'

const STATUS_CHART_COLORS = STATUS_COLORS
const TYPE_CHART_COLORS = ['var(--color-primary)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-success)']

const tooltipStyle = {
  background: 'var(--void-2)',
  border: '1px solid var(--glass-border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  padding: '8px 10px',
}
const axisTick = { fill: 'var(--text-faint)', fontSize: 11 }
const legendStyle = { fontSize: 11, color: 'var(--text-dim)' }

/** ₹2L / ₹5.4Cr style compact formatting for axis ticks and ranked-list
 * values -- raw numbers like "22000000" on a chart axis are exactly what
 * this replaces. Tooltips and the KPI headline still use the full
 * <Money/> component -- abbreviation is only for space-constrained spots. */
function formatINRShort(value) {
  const n = Number(value) || 0
  const abs = Math.abs(n)
  if (abs >= 1_00_00_000) return `\u20b9${(n / 1_00_00_000).toFixed(abs % 1_00_00_000 === 0 ? 0 : 1)}Cr`
  if (abs >= 1_00_000) return `\u20b9${(n / 1_00_000).toFixed(abs % 1_00_000 === 0 ? 0 : 1)}L`
  if (abs >= 1_000) return `\u20b9${(n / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}K`
  return `\u20b9${n.toFixed(0)}`
}

function rangeBounds(range) {
  const now = new Date()
  switch (range) {
    case '7d': return { since: new Date(now - 7 * 86400000), until: now }
    case '30d': return { since: new Date(now - 30 * 86400000), until: now }
    case '90d': return { since: new Date(now - 90 * 86400000), until: now }
    case 'year': return { since: new Date(now.getFullYear(), 0, 1), until: now }
    default: return { since: null, until: null }
  }
}

function previousBounds({ since, until }) {
  if (!since || !until) return null
  const span = until.getTime() - since.getTime()
  return { since: new Date(since.getTime() - span), until: new Date(since.getTime()) }
}

/**
 * Wraps one analytics panel so it only reveals -- and, crucially, only
 * MOUNTS its chart -- once scrolled into view. `once: true` means it never
 * re-triggers once shown. The render-prop passes `entered` down so the
 * panel's own chart/bars can defer their draw-in animation to this exact
 * moment instead of animating immediately on page load while off-screen
 * (which is what "all animations happen immediately" looked like before).
 */
function RevealSection({ className, children }) {
  const [entered, setEntered] = useState(false)
  const vars = useMotionVariants(staticCardVariants)
  return (
    <motion.section
      className={className}
      variants={vars}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.3 }}
      onViewportEnter={() => setEntered(true)}
    >
      {children(entered)}
    </motion.section>
  )
}

/** A clean horizontal ranking -- name, abbreviated amount, proportional
 * CSS bar -- used for Top companies and Top accounts instead of a
 * Recharts bar chart. `active` defers the bars growing from 0 until the
 * panel has actually entered the viewport (see RevealSection above),
 * rather than snapping straight to full width on mount. */
function RankedBarList({ items, nameKey, sublabelKey, valueKey, color, active }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [active])

  const max = Math.max(1, ...items.map((i) => i[valueKey]))
  return (
    <ul className="ranked-bar-list">
      {items.map((item, i) => (
        <li key={item.id || i}>
          <div className="ranked-bar-row-top">
            <span className="ranked-bar-name" title={item[nameKey]}>
              {item[nameKey]}
              {sublabelKey && item[sublabelKey] && <span className="ranked-bar-sublabel"> \u00b7 {item[sublabelKey]}</span>}
            </span>
            <span className="ranked-bar-value mono">{formatINRShort(item[valueKey])}</span>
          </div>
          <div className="ranked-bar-track">
            <div className="ranked-bar-fill" style={{ width: grown ? `${Math.max(4, (item[valueKey] / max) * 100)}%` : '0%', background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Same grow-from-0-on-reveal treatment as RankedBarList, for the two
 * Incoming/Outgoing rows. */
function IncomingOutgoingBars({ incoming, outgoing, active, t }) {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    if (!active) return
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [active])

  const total = incoming + outgoing
  const inPct = total > 0 ? (incoming / total) * 100 : 0
  const outPct = total > 0 ? (outgoing / total) * 100 : 0

  return (
    <div className="reports-io-list">
      <div className="reports-io-row">
        <div className="reports-io-row-top">
          <span>{t('chart_incoming')}</span>
          <span className="mono">{formatINRShort(incoming)}</span>
        </div>
        <div className="ranked-bar-track">
          <div className="ranked-bar-fill" style={{ width: grown ? `${inPct}%` : '0%', background: 'var(--chart-income)' }} />
        </div>
      </div>
      <div className="reports-io-row">
        <div className="reports-io-row-top">
          <span>{t('chart_outgoing')}</span>
          <span className="mono">{formatINRShort(outgoing)}</span>
        </div>
        <div className="ranked-bar-track">
          <div className="ranked-bar-fill" style={{ width: grown ? `${outPct}%` : '0%', background: 'var(--chart-expense)' }} />
        </div>
      </div>
    </div>
  )
}

export default function ReportsPage({ token }) {
  const { t, tType, dateLocale } = useT()

  const [companies, setCompanies] = useState([])
  const [scopeCompanyId, setScopeCompanyId] = useState('')
  const [range, setRange] = useState('30d')

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [insightFetchedAt, setInsightFetchedAt] = useState(null)

  // Still fetched -- needed to compute the previous-period KPI deltas
  // client-side (same pattern the Dashboard uses). The detailed
  // transaction table itself has been removed from Reports (that's what
  // the dedicated Transfers/Transactions pages are for); this list is now
  // purely a numbers source, never rendered as rows.
  const [transfers, setTransfers] = useState([])

  const [error, setError] = useState('')

  const bounds = useMemo(() => rangeBounds(range), [range])
  const prevBounds = useMemo(() => previousBounds(bounds), [bounds])

  useEffect(() => {
    api.listCompanies(token).then(setCompanies).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.getReports(token, {
      companyId: scopeCompanyId || undefined,
      since: bounds.since?.toISOString(),
      until: bounds.until?.toISOString(),
    })
      .then((data) => { if (!cancelled) { setReport(data); setInsightFetchedAt(Date.now()) } })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, scopeCompanyId, bounds.since, bounds.until])

  useEffect(() => {
    let cancelled = false
    const fetchP = scopeCompanyId ? api.listTransfers(token, scopeCompanyId) : api.listAllTransfers(token)
    fetchP
      .then((data) => { if (!cancelled) setTransfers(data) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [token, scopeCompanyId])

  const data = report?.data
  const statusEntries = data ? Object.entries(data.count_by_status || {}).filter(([, v]) => v > 0) : []
  const typeEntries = data ? Object.entries(data.count_by_type || {}).filter(([, v]) => v > 0) : []

  const prevTotals = useMemo(() => {
    if (!prevBounds) return null
    let count = 0, amount = 0
    for (const tr of transfers) {
      const d = new Date(tr.transaction_date)
      if (d >= prevBounds.since && d < prevBounds.until) { count += 1; amount += Number(tr.amount) }
    }
    return { count, amount }
  }, [transfers, prevBounds])

  function pctDelta(current, previous) {
    if (previous === 0) return current > 0 ? null : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const findings = useMemo(() => {
    if (!data) return []
    const list = []
    if (data.scope === 'global' && data.top_companies?.length > 1) {
      const top = data.top_companies[0]
      const totalAmt = data.top_companies.reduce((s, c) => s + c.amount, 0)
      if (totalAmt > 0) {
        list.push({
          icon: '\u25cf',
          label: t('finding_most_active', { name: top.name }),
          sublabel: t('finding_most_active_sub', { pct: Math.round((top.amount / totalAmt) * 100) }),
        })
      }
    }
    const statusPairs = Object.entries(data.count_by_status || {}).filter(([, v]) => v > 0)
    if (statusPairs.length > 0) {
      const [topStatus, topCount] = statusPairs.sort((a, b) => b[1] - a[1])[0]
      list.push({ icon: '\u25cf', label: t('reports_dominant_status', { status: t(`status_${topStatus}`) }), sublabel: t('reports_dominant_status_sub', { n: topCount, total: data.total_transfers }) })
    }
    const pending = data.count_by_status?.PENDING || 0
    list.push(
      pending === 0
        ? { icon: '\u2013', label: t('finding_no_pending'), sublabel: t('finding_no_pending_sub') }
        : { icon: '!', label: t('finding_pending', { n: pending }), sublabel: t('finding_pending_sub') }
    )
    return list
  }, [data, t])

  async function refreshInsight() {
    setLoading(true)
    setError('')
    try {
      const fresh = await api.getReports(token, {
        companyId: scopeCompanyId || undefined,
        since: bounds.since?.toISOString(),
        until: bounds.until?.toISOString(),
      })
      setReport(fresh)
      setInsightFetchedAt(Date.now())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const showPrevDelta = !!prevBounds
  const hasCompanyChart = data?.scope === 'global' && data?.top_companies?.length > 0
  const hasAccountsList = data?.top_accounts?.length > 0
  const kpiListVars = useMotionVariants(listVariants)
  const kpiItemVars = useMotionVariants(listItemVariants)

  return (
    <PageLayout
      width="wide"
      title={t('reports_nav')}
      titleId="page-title"
      subtitle={t('reports_page_hint')}
      actions={
        <div className="reports-filters">
          <select className="reports-scope-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label={t('reports_range_label')}>
            <option value="7d">{t('reports_range_7d')}</option>
            <option value="30d">{t('reports_range_30d')}</option>
            <option value="90d">{t('reports_range_90d')}</option>
            <option value="year">{t('reports_range_year')}</option>
            <option value="all">{t('reports_range_all')}</option>
          </select>
          <select className="reports-scope-select" value={scopeCompanyId} onChange={(e) => setScopeCompanyId(e.target.value)} aria-label={t('reports_company_label')}>
            <option value="">{t('reports_scope_all')}</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
      }
    >
      <ErrorNote message={error} />

      {/* reports-sections is the single source of truth for vertical
          rhythm on this page: every direct child (AI summary, KPI row,
          each analytics row) gets the exact same gap via one CSS rule
          (index.css: ".reports-sections > * + *"), instead of each
          section type carrying its own margin that could drift out of
          sync with the others or compound if applied twice. Individual
          .panel/.reports-kpi-row/.reports-grid-row margins are zeroed
          out inside this wrapper for that reason -- see index.css. */}
      <div className="reports-sections">
      {/* animate (mount-triggered), not whileInView: this section sits at
          the very top of the page and is always visible on load already --
          no scrolling is ever needed to see it. whileInView here was the
          actual bug: its IntersectionObserver check can run before the
          page's content height has settled (while `loading` is still
          resolving), miss the "already in view" case, and -- combined
          with `once: true` -- never fire again, leaving the section
          permanently stuck at its invisible `initial` state while still
          occupying its full layout height. That's what read as "empty
          space": real elements, rendered at opacity 0. animate sidesteps
          this by firing unconditionally on mount, exactly like a normal
          page-load entrance. */}
      <motion.div
        className="reports-ai-summary"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.base, ease: easing.out }}
      >
        <InsightsCard
          title={t('ai_summary_title')}
          insights={report ? { insight: report.insight, cached: report.cached } : null}
          loading={loading}
          onGenerate={refreshInsight}
          emptyHint={t('reports_page_hint')}
          fetchedAt={insightFetchedAt}
          findings={findings}
          compact
        />
      </motion.div>

      {/* Same fix as the AI summary above, same reason: always visible on
          load, so this animates on mount rather than gambling on a
          viewport check for content that was never actually below the
          fold in the first place. */}
      <motion.div
        className="kpi-row reports-kpi-row"
        variants={kpiListVars}
        initial="initial"
        animate="animate"
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <div className="reports-kpi-tile" key={i}><SkeletonLine width="60%" height={26} /></div>)
        ) : !data ? null : (
          <>
            <motion.div className="reports-kpi-tile" variants={kpiItemVars}>
              <span className="reports-kpi-label">{t('kpi_total_amount')}</span>
              <span className="reports-kpi-value mono"><Money value={data.total_amount} /></span>
              {showPrevDelta && prevTotals && (() => {
                const d = pctDelta(data.total_amount, prevTotals.amount)
                return d === null ? <span className="reports-kpi-delta-spacer" /> : (
                  <span className={`reports-kpi-delta${d < 0 ? ' down' : ''}`}>
                    {d >= 0 ? '\u2191' : '\u2193'} {Math.abs(d)}% {t('reports_vs_previous')}
                  </span>
                )
              })()}
            </motion.div>
            <motion.div className="reports-kpi-tile" variants={kpiItemVars}>
              <span className="reports-kpi-label">{t('kpi_total_transfers')}</span>
              <span className="reports-kpi-value mono">{data.total_transfers}</span>
              {showPrevDelta && prevTotals && (() => {
                const d = pctDelta(data.total_transfers, prevTotals.count)
                return d === null ? <span className="reports-kpi-delta-spacer" /> : (
                  <span className={`reports-kpi-delta${d < 0 ? ' down' : ''}`}>{d >= 0 ? '\u2191' : '\u2193'} {Math.abs(d)}%</span>
                )
              })()}
            </motion.div>
            <motion.div className="reports-kpi-tile" variants={kpiItemVars}>
              <span className="reports-kpi-label">{t('status_COMPLETED')}</span>
              <span className="reports-kpi-value mono reports-kpi-positive">{data.count_by_status.COMPLETED || 0}</span>
              {data.total_transfers > 0 && (
                <span className="reports-kpi-delta">{Math.round(((data.count_by_status.COMPLETED || 0) / data.total_transfers) * 100)}% {t('reports_of_total')}</span>
              )}
            </motion.div>
            <motion.div className="reports-kpi-tile" variants={kpiItemVars}>
              <span className="reports-kpi-label">{t('status_PENDING')}</span>
              <span className={`reports-kpi-value mono${(data.count_by_status.PENDING || 0) > 0 ? ' reports-kpi-warning' : ''}`}>
                {data.count_by_status.PENDING || 0}
              </span>
              <span className="reports-kpi-delta-spacer" />
            </motion.div>
          </>
        )}
      </motion.div>

      {loading ? (
        <section className="panel"><SkeletonLine width="100%" height={260} /></section>
      ) : !data || data.total_transfers === 0 ? (
        <EmptyState
          icon={IconBuilding}
          title={t('reports_no_activity_title')}
          hint={t('reports_no_activity_hint')}
          action={range !== 'all' && <button className="btn-ghost small" onClick={() => setRange('all')}>{t('reports_adjust_range')}</button>}
        />
      ) : (
        <>
          {/* Row 1 -- primary trend (amount + count, dual axis) + status breakdown */}
          <div className="reports-grid-row reports-row-primary">
            {data.time_series.length > 0 && (
              <RevealSection className="panel reports-chart-panel reports-chart-primary">
                {(entered) => (
                  <>
                    <h2>{t('chart_volume_value')}</h2>
                    <p className="reports-chart-subtitle">{t('chart_volume_subtitle')}</p>
                    {entered ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.time_series} margin={{ top: 8, left: 0, right: 8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" vertical={false} />
                          <XAxis dataKey="date" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--glass-border)' }} minTickGap={24} />
                          <YAxis
                            yAxisId="amount" tick={axisTick} tickLine={false} axisLine={false}
                            tickFormatter={formatINRShort} width={56}
                          />
                          <YAxis
                            yAxisId="count" orientation="right" tick={axisTick} tickLine={false} axisLine={false}
                            allowDecimals={false} width={28}
                          />
                          <Tooltip
                            cursor={{ stroke: 'var(--glass-border-hi)' }}
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const point = payload[0].payload
                              return (
                                <div style={tooltipStyle}>
                                  <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{new Date(label).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}</div>
                                  <div style={{ fontWeight: 600 }}>{'\u20b9' + Number(point.amount).toLocaleString('en-IN')}</div>
                                  <div style={{ color: 'var(--text-dim)' }}>{t('reports_tooltip_transfers', { n: point.count })}</div>
                                </div>
                              )
                            }}
                          />
                          <Legend wrapperStyle={legendStyle} formatter={(value) => (value === 'amount' ? t('chart_amount') : t('chart_count'))} />
                          <Line yAxisId="amount" type="monotone" dataKey="amount" name="amount" stroke="var(--color-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={550} />
                          <Line yAxisId="count" type="monotone" dataKey="count" name="count" stroke="var(--chart-trend)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 3 }} animationDuration={550} animationBegin={120} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: 300 }} />
                    )}
                  </>
                )}
              </RevealSection>
            )}

            {statusEntries.length > 0 && (
              <RevealSection className="panel reports-chart-panel reports-chart-secondary">
                {(entered) => (
                  <>
                    <h2>{t('chart_status_breakdown')}</h2>
                    {entered ? (
                      <>
                        <div className="reports-donut-wrap">
                          <ResponsiveContainer width="100%" height={168}>
                            <PieChart>
                              <Pie
                                data={statusEntries.map(([k, v]) => ({ name: t(`status_${k}`), value: v }))}
                                dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} animationDuration={450} stroke="none"
                              >
                                {statusEntries.map(([k]) => <Cell key={k} fill={STATUS_CHART_COLORS[k] || 'var(--text-faint)'} />)}
                              </Pie>
                              <Tooltip contentStyle={tooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="reports-donut-center">
                            <span className="reports-donut-total mono">{data.total_transfers}</span>
                            <span className="reports-donut-label">{t('kpi_total_transfers')}</span>
                          </div>
                        </div>
                        <ul className="reports-status-legend">
                          {statusEntries.map(([k, v]) => (
                            <li key={k}>
                              <span className="reports-status-swatch" style={{ background: STATUS_CHART_COLORS[k] || 'var(--text-faint)' }} />
                              {t(`status_${k}`)} <span className="dim mono">{v}</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <div style={{ height: 168 }} />
                    )}
                  </>
                )}
              </RevealSection>
            )}
          </div>

          {/* Row 2 -- company activity + incoming/outgoing (each half-width,
              or incoming/outgoing takes the full row alone when scoped to a
              single company, since there's no "other companies" to rank) */}
          <div className="reports-grid-row reports-row-half">
            {hasCompanyChart && (
              <RevealSection className="panel reports-chart-panel">
                {(entered) => (
                  <>
                    <h2>{t('chart_top_companies')}</h2>
                    <RankedBarList items={data.top_companies} nameKey="name" valueKey="amount" color="var(--chart-volume)" active={entered} />
                  </>
                )}
              </RevealSection>
            )}
            <RevealSection className={`panel reports-chart-panel${hasCompanyChart ? '' : ' reports-chart-full'}`}>
              {(entered) => (
                <>
                  <h2>{t('chart_incoming_outgoing')}</h2>
                  <IncomingOutgoingBars incoming={data.incoming_total} outgoing={data.outgoing_total} active={entered} t={t} />
                </>
              )}
            </RevealSection>
          </div>

          {/* Row 3 -- transfer type distribution + top accounts, paired so
              nothing sits alone with empty space beside it. */}
          {(typeEntries.length > 0 || hasAccountsList) && (
            <div className="reports-grid-row reports-row-half">
              {typeEntries.length > 0 && (
                <RevealSection className={`panel reports-chart-panel${hasAccountsList ? '' : ' reports-chart-full'}`}>
                  {(entered) => (
                    <>
                      <h2>{t('chart_type_distribution')}</h2>
                      {entered ? (
                        <>
                          <div className="reports-donut-wrap">
                            <ResponsiveContainer width="100%" height={168}>
                              <PieChart>
                                <Pie data={typeEntries.map(([k, v]) => ({ name: tType(k), value: v }))} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} animationDuration={450} stroke="none">
                                  {typeEntries.map(([k], i) => <Cell key={k} fill={TYPE_CHART_COLORS[i % TYPE_CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyle} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <ul className="reports-status-legend">
                            {typeEntries.map(([k, v], i) => (
                              <li key={k}>
                                <span className="reports-status-swatch" style={{ background: TYPE_CHART_COLORS[i % TYPE_CHART_COLORS.length] }} />
                                {tType(k)} <span className="dim mono">{v}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <div style={{ height: 168 }} />
                      )}
                    </>
                  )}
                </RevealSection>
              )}

              {hasAccountsList && (
                <RevealSection className={`panel reports-chart-panel${typeEntries.length > 0 ? '' : ' reports-chart-full'}`}>
                  {(entered) => (
                    <>
                      <h2>{t('chart_top_accounts')}</h2>
                      <RankedBarList items={data.top_accounts} nameKey="company_name" valueKey="amount" color="var(--color-warning)" active={entered} />
                    </>
                  )}
                </RevealSection>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </PageLayout>
  )
}
