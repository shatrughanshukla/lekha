import { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { ErrorNote, DeleteButton, IconSearch, IconPlus, IconBuilding } from './Shared.jsx'

export default function Dashboard({ token, user, onOpenCompany }) {
  const [companies, setCompanies] = useState([])
  const [filter, setFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setCompanies(await api.listCompanies(token))
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
