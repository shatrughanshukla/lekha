import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import CompanyView from './CompanyView.jsx'
import { api } from '../api.js'
import { useT } from '../i18n.jsx'
import PageLayout from './PageLayout.jsx'

// CompanyView expects a full company object, not just an id — when
// navigating here from a Dashboard card click we already have that object
// and pass it via router state (no extra request). On a direct visit,
// refresh, or shared link, there's no state, so this fetches the list and
// finds the match — there's no single-company endpoint on the backend,
// and adding one is out of scope for a frontend-only phase.
export default function CompanyRoute({ token, user }) {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useT()
  const [company, setCompany] = useState(location.state?.company || null)
  const [loading, setLoading] = useState(!location.state?.company)
  const [error, setError] = useState('')

  useEffect(() => {
    if (company) return
    let cancelled = false
    api.listCompanies(token)
      .then((companies) => {
        if (cancelled) return
        const match = companies.find((c) => c.id === id)
        if (match) setCompany(match)
        else setError(t('company_not_found_msg'))
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <PageLayout restoreScroll={false}><div className="empty-state">{t('loading')}</div></PageLayout>
  if (error) return <PageLayout restoreScroll={false}><div className="empty-state">{error}</div></PageLayout>
  if (!company) return null

  return <CompanyView token={token} user={user} company={company} onBack={() => navigate('/app')} />
}
