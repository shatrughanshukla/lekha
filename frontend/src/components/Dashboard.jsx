import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { ErrorNote, DeleteButton, IconSearch, IconPlus, IconBuilding, IconSparkle } from './Shared.jsx'
import { getCached, setCached } from '../cache.js'
import { useT } from '../i18n.jsx'

export default function Dashboard({ token, user, onOpenCompany }) {
  const [companies, setCompanies] = useState(() => getCached('companies') ?? [])
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(() => !getCached('companies'))
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const { t, dateLocale } = useT()

  async function refresh() {
    // Only show the loading state when we have nothing to show yet — if
    // cached data is already on screen, refresh silently in the background.
    if (!getCached('companies')) setLoading(true)
    try {
      const data = await api.listCompanies(token)
      setCompanies(data)
      setCached('companies', data)
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
      setInsights(await api.getOverviewInsights(token))
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

  async function removeCompany(id) {
    setError('')
    try {
      await api.deleteCompany(token, id)
      refresh()
    } catch (err) {
      // A company with existing accounts can't be deleted (foreign key) —
      // that's the API correctly protecting real data, surface it plainly.
      setError(err.message)
    }
  }

  const shown = useMemo(
    () => companies.filter((c) => c.company_name.toLowerCase().includes(filter.toLowerCase())),
    [companies, filter],
  )

  return (
    <div className="page">
      <div className="dash-head">
        <div>
          <h1 className="page-title">{t('your_companies')}</h1>
          <p className="page-sub">
            {t('on_record', { n: companies.length })}{filter && t('matching', { n: shown.length, q: filter })}
          </p>
        </div>
        <div className="search-box">
          <IconSearch />
          <input placeholder={t('filter_placeholder')} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

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
          <p className="panel-hint">{t('overview_insight_hint')}</p>
        )}
      </section>

      <ErrorNote message={error} />

      {loading ? (
        <div className="empty-state">{t('loading')}</div>
      ) : (
        <div className="company-grid">
          {shown.map((c) => (
            <button key={c.id} className="company-card" onClick={() => onOpenCompany(c)}>
              <div className="company-card-top">
                <IconBuilding />
                <DeleteButton onConfirm={() => removeCompany(c.id)} labelKey="delete_company_label" />
              </div>
              <div className="company-card-name">{c.company_name}</div>
              <div className="company-card-meta mono">{c.id.slice(0, 8)}…</div>
              <div className="company-card-date">
                {t('opened_on', { date: new Date(c.created_at).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' }) })}
              </div>
            </button>
          ))}

          {creating ? (
            <form className="company-card new-card-form" onSubmit={createCompany}>
              <input
                autoFocus
                placeholder={t('company_name_placeholder')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <div className="new-card-actions">
                <button type="submit" className="btn-primary small">
                  {t('create')}
                </button>
                <button type="button" className="btn-ghost small" onClick={() => setCreating(false)}>
                  {t('cancel')}
                </button>
              </div>
            </form>
          ) : (
            <button className="company-card new-card" onClick={() => setCreating(true)}>
              <IconPlus />
              <span>{t('new_company')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
