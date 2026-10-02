import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import AuthScreen from './components/AuthScreen.jsx'
import LandingPage from './components/landing/LandingPage.jsx'
// The authenticated app is code-split: a visitor on the public landing page
// (or auth screen) shouldn't download the dashboard, charts library and
// every page before they've even signed in.
const AppShell = lazy(() => import('./components/AppShell.jsx'))
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))
const CompanyRoute = lazy(() => import('./components/CompanyRoute.jsx'))
const AccountsPage = lazy(() => import('./components/AccountsPage.jsx'))
const TransferLedgerPage = lazy(() => import('./components/TransferLedgerPage.jsx'))
const ReportsPage = lazy(() => import('./components/ReportsPage.jsx'))
const ChatPage = lazy(() => import('./components/ChatPage.jsx'))

// Suspense boundary per route element (inside AppShell's outlet), so the
// shell stays mounted while a page chunk loads for the first time.
const Lazy = ({ children }) => <Suspense fallback={null}>{children}</Suspense>
import ResetPasswordScreen from './components/ResetPasswordScreen.jsx'
import { useT } from './i18n.jsx'
import { api } from './api.js'

// Read once at module load, not on every render — these only ever matter
// for the page load that actually landed here from an emailed link.
const initialSearchParams = new URLSearchParams(window.location.search)
const initialResetToken = initialSearchParams.get('reset_token')
const initialVerifyToken = initialSearchParams.get('verify_token')

function stripTokenFromURL(paramName) {
  const url = new URL(window.location.href)
  url.searchParams.delete(paramName)
  window.history.replaceState({}, '', url.toString())
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lekha_token') || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lekha_user')
    return raw ? JSON.parse(raw) : null
  })
  const [theme, setTheme] = useState(() => localStorage.getItem('lekha_theme') || 'dark')
  const [showResetScreen, setShowResetScreen] = useState(!!initialResetToken)
  const [verifyBannerMsg, setVerifyBannerMsg] = useState(null)
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const { t, lang, setLang } = useT()

  // Handles the ?verify_token= link from a verification email. Runs once
  // regardless of whether this browser happens to be signed in — the
  // token itself is what proves ownership of the email, not the session.
  useEffect(() => {
    if (!initialVerifyToken) return
    api.verifyEmail(initialVerifyToken)
      .then(() => {
        setVerifyBannerMsg({ type: 'success', text: t('email_verified_success_msg') })
        // Best-effort local update so the "please verify" banner clears
        // immediately for a logged-in user, without waiting for their next
        // sign-in to pick up the fresh value from the server.
        setUser((prev) => {
          if (!prev) return prev
          const updated = { ...prev, email_verified: true }
          localStorage.setItem('lekha_user', JSON.stringify(updated))
          return updated
        })
      })
      .catch((err) => setVerifyBannerMsg({ type: 'error', text: err.message }))
      .finally(() => stripTokenFromURL('verify_token'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lekha_theme', theme)
  }, [theme])

  // Silently extends the session while it's actively being used, so an
  // open tab doesn't get logged out mid-day just because the token turned
  // 24h old. An abandoned/closed tab still lets the token expire normally —
  // this only refreshes while something is actually running.
  useEffect(() => {
    if (!token) return

    async function refresh() {
      try {
        const { token: freshToken } = await api.refreshToken(token)
        localStorage.setItem('lekha_token', freshToken)
        setToken(freshToken)
      } catch {
        // Token may already be expired, or the network's down — fail
        // quietly. If it's really expired, the next real request 401s and
        // the person just signs in again, same as before this existed.
      }
    }

    const interval = setInterval(refresh, 20 * 60 * 1000) // every 20 minutes
    function onVisible() {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function toggleLang() {
    const next = lang === 'en' ? 'hi' : 'en'
    setLang(next)
    // Keep it persisted to the profile too, so it actually "always follows
    // you across devices" the way it's supposed to, not just this browser.
    if (user && token) {
      api.updateUser(token, user.id, { preferred_language: next })
        .then(handleProfileUpdated)
        .catch(() => {}) // language still switches locally even if the save fails
    }
  }

  function handleProfileUpdated(updatedUser) {
    localStorage.setItem('lekha_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  function handleAuthed(newToken, newUser, mode) {
    localStorage.setItem('lekha_token', newToken)
    localStorage.setItem('lekha_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)

    if (mode === 'signup') {
      // Brand new account — push whatever language was already chosen on
      // this device up to the new profile, if it's not already the same.
      if (newUser.preferred_language !== lang) {
        api.updateUser(newToken, newUser.id, { preferred_language: lang }).catch(() => {})
      }
    } else if (newUser.preferred_language && newUser.preferred_language !== lang) {
      // Returning user — their saved preference follows them across
      // devices, so adopt it even if this browser had something else set.
      setLang(newUser.preferred_language)
    }
  }

  function signOut() {
    localStorage.removeItem('lekha_token')
    localStorage.removeItem('lekha_user')
    setToken('')
    setUser(null)
  }

  async function resendVerification() {
    setResendingVerification(true)
    try {
      await api.resendVerificationEmail(token)
      setVerifyBannerMsg({ type: 'success', text: t('verification_resent_msg') })
    } catch (err) {
      setVerifyBannerMsg({ type: 'error', text: err.message })
    } finally {
      setResendingVerification(false)
    }
  }

  if (showResetScreen) {
    return (
      <ResetPasswordScreen
        token={initialResetToken}
        onDone={() => {
          stripTokenFromURL('reset_token')
          setShowResetScreen(false)
        }}
      />
    )
  }

  const shellProps = {
    token, user, theme, setTheme, lang, toggleLang,
    onProfileUpdated: handleProfileUpdated, signOut,
    verifyBannerMsg, setVerifyBannerMsg, verifyBannerDismissed, setVerifyBannerDismissed,
    resendingVerification, resendVerification,
  }

  return (
    <Routes>
      <Route
        path="/"
        element={token && user ? <Navigate to="/app" replace /> : <LandingPage theme={theme} setTheme={setTheme} />}
      />
      <Route
        path="/auth"
        element={token && user ? <Navigate to="/app" replace /> : <AuthScreen onAuthed={handleAuthed} theme={theme} setTheme={setTheme} />}
      />

      <Route path="/app" element={<Lazy><AppShell {...shellProps} /></Lazy>}>
        <Route index element={<Lazy><DashboardRoute token={token} user={user} /></Lazy>} />
        <Route path="accounts" element={<Lazy><AccountsPage token={token} user={user} /></Lazy>} />
        <Route path="transfers" element={<Lazy><TransferLedgerPage token={token} user={user} scope="mine" /></Lazy>} />
        <Route path="transactions" element={<Lazy><TransferLedgerPage token={token} user={user} scope="all" /></Lazy>} />
        <Route path="assistant" element={<Lazy><ChatPage token={token} user={user} /></Lazy>} />
        <Route path="reports" element={<Lazy><ReportsPage token={token} user={user} /></Lazy>} />
        <Route path="companies/:id" element={<Lazy><CompanyRoute token={token} user={user} /></Lazy>} />
      </Route>

      <Route path="*" element={<Navigate to={token && user ? '/app' : '/'} replace />} />
    </Routes>
  )
}

// Dashboard navigates to a company via a real route instead of local state,
// carrying the already-loaded object in router state so CompanyRoute can
// skip a redundant fetch on the common click-through path.
function DashboardRoute({ token, user }) {
  const navigate = useNavigate()
  return (
    <Dashboard
      token={token}
      user={user}
      onOpenCompany={(company) => navigate(`/app/companies/${company.id}`, { state: { company } })}
    />
  )
}
