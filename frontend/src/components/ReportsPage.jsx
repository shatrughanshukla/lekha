import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../api.js'
import { Money, ErrorNote, IconSparkle } from './Shared.jsx'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'

const STATUS_CHART_COLORS = {
  PENDING: 'var(--color-warning)',
  COMPLETED: 'var(--color-success)',
  CANCELLED: 'var(--color-cancelled)',
  REVERSED: 'var(--color-reversed)',
}
const TYPE_CHART_COLORS = ['var(--color-primary)', 'var(--color-info)', 'var(--color-warning)', 'var(--color-success)']

const tooltipStyle = {
  background: 'var(--void-2)',
  border: '1px solid var(--glass-border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
}
const axisTick = { fill: 'var(--text-dim)', fontSize: 11 }

export default function ReportsPage({ token, user }) {
  const { t, tType } = useT()
  const [companies, setCompanies] = useState([])
  const [scopeCompanyId, setScopeCompanyId] = useState('') // '' = global, across every company
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listCompanies(token).then(setCompanies).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeCompanyId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      setReport(await api.getReports(token, scopeCompanyId || undefined))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const data = report?.data
  const statusEntries = data ? Object.entries(data.count_by_status || {}).filter(([, v]) => v > 0) : []
  const typeEntries = data ? Object.entries(data.count_by_type || {}).filter(([, v]) => v > 0) : []

  return (
    <PageLayout
      title={t('reports_nav')}
      titleId="page-title"
      subtitle={t('reports_page_hint')}
      actions={
        <select
          className="reports-scope-select"
          value={scopeCompanyId}
          onChange={(e) => setScopeCompanyId(e.target.value)}
        >
          <option value="">{t('reports_scope_all')}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
      }
    >

      <ErrorNote message={error} />

      {loading ? (
        <div className="empty-state">{t('loading')}</div>
      ) : !data ? null : (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <span className="kpi-label">{t('kpi_total_transfers')}</span>
              <span className="kpi-value">{data.total_transfers}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">{t('kpi_total_amount')}</span>
              <span className="kpi-value"><Money value={data.total_amount} /></span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">{t('status_PENDING')}</span>
              <span className="kpi-value" style={{ color: 'var(--amber)' }}>{data.count_by_status.PENDING || 0}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">{t('status_COMPLETED')}</span>
              <span className="kpi-value" style={{ color: 'var(--mint)' }}>{data.count_by_status.COMPLETED || 0}</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">{t('status_CANCELLED')}</span>
              <span className="kpi-value" style={{ color: 'var(--danger)' }}>{data.count_by_status.CANCELLED || 0}</span>
            </div>
          </div>

          <section className="panel">
            <h2><IconSparkle width={17} height={17} /> {t('ai_summary_title')}</h2>
            <p className="insight-text">{report.insight}</p>
          </section>

          {data.time_series.length > 0 && (
            <section className="panel">
              <h2>{t('chart_volume_value')}</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.time_series} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="date" tick={axisTick} />
                  <YAxis yAxisId="left" tick={axisTick} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                  <Line yAxisId="left" type="monotone" dataKey="count" name={t('chart_count')} stroke="var(--cyan)" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="amount" name={t('chart_amount')} stroke="var(--violet)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}

          <div className="reports-grid-2">
            {statusEntries.length > 0 && (
              <section className="panel">
                <h2>{t('chart_status_breakdown')}</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={statusEntries.map(([k, v]) => ({ name: t(`status_${k}`), value: v }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label
                    >
                      {statusEntries.map(([k]) => (
                        <Cell key={k} fill={STATUS_CHART_COLORS[k] || 'var(--text-faint)'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            )}

            {typeEntries.length > 0 && (
              <section className="panel">
                <h2>{t('chart_type_distribution')}</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={typeEntries.map(([k, v]) => ({ name: tType(k), value: v }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={80}
                      label
                    >
                      {typeEntries.map(([k], i) => (
                        <Cell key={k} fill={TYPE_CHART_COLORS[i % TYPE_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-dim)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            )}
          </div>

          <section className="panel">
            <h2>{t('chart_incoming_outgoing')}</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                layout="vertical"
                data={[
                  { name: t('chart_incoming'), value: data.incoming_total },
                  { name: t('chart_outgoing'), value: data.outgoing_total },
                ]}
                margin={{ left: 8, right: 24 }}
              >
                <XAxis type="number" tick={axisTick} />
                <YAxis type="category" dataKey="name" tick={{ ...axisTick, fontSize: 12 }} width={90} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  <Cell fill="var(--mint)" />
                  <Cell fill="var(--danger)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          {data.scope === 'global' && data.top_companies?.length > 0 && (
            <section className="panel">
              <h2>{t('chart_top_companies')}</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.top_companies} margin={{ left: 4, right: 8 }}>
                  <XAxis dataKey="name" tick={axisTick} />
                  <YAxis tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, t('kpi_total_amount')]} />
                  <Bar dataKey="amount" fill="var(--cyan)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {data.top_accounts?.length > 0 && (
            <section className="panel">
              <h2>{t('chart_top_accounts')}</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.top_accounts} margin={{ left: 4, right: 8 }}>
                  <XAxis dataKey="company_name" tick={axisTick} />
                  <YAxis tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, t('kpi_total_amount')]} />
                  <Bar dataKey="amount" fill="var(--amber)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}
    </PageLayout>
  )
}
