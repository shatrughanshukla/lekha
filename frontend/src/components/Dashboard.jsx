import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { ErrorNote, DeleteButton, IconSearch, IconPlus, IconBuilding, IconSparkle } from './Shared.jsx'
import { getCached, setCached } from '../cache.js'

export default function Dashboard({ token, user, onOpenCompany }) {
  const [companies, setCompanies] = useState(() => getCached('companies') ?? [])
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(() => !getCached('companies'))
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

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
          <h1 className="page-title">Your companies</h1>
          <p className="page-sub">
            {companies.length} on record{filter && `, ${shown.length} matching "${filter}"`}
          </p>
        </div>
        <div className="search-box">
          <IconSearch />
          <input placeholder="Filter by name…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2><IconSparkle /> Insights</h2>
          <button className="btn-ghost small" onClick={loadInsights} disabled={insightsLoading}>
            {insightsLoading ? 'Thinking…' : insights ? 'Refresh' : 'Generate'}
          </button>
        </div>
        {insights ? (
          <p className="insight-text">
            {insights.insight}
            {insights.cached && <span className="cached-hint" title="Nothing has changed since the last time this was generated, so this is reused rather than a fresh AI call">⚡ cached</span>}
          </p>
        ) : (
          <p className="panel-hint">AI-written summary across every company you belong to — total activity, which companies are busiest, and which have none yet.</p>
        )}
      </section>

      <ErrorNote message={error} />

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <div className="company-grid">
          {shown.map((c) => (
            <button key={c.id} className="company-card" onClick={() => onOpenCompany(c)}>
              <div className="company-card-top">
                <IconBuilding />
                <DeleteButton onConfirm={() => removeCompany(c.id)} label="company" />
              </div>
              <div className="company-card-name">{c.company_name}</div>
              <div className="company-card-meta mono">{c.id.slice(0, 8)}…</div>
              <div className="company-card-date">
                opened {new Date(c.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </button>
          ))}

          {creating ? (
            <form className="company-card new-card-form" onSubmit={createCompany}>
              <input
                autoFocus
                placeholder="Company name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <div className="new-card-actions">
                <button type="submit" className="btn-primary small">
                  Create
                </button>
                <button type="button" className="btn-ghost small" onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button className="company-card new-card" onClick={() => setCreating(true)}>
              <IconPlus />
              <span>New company</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
