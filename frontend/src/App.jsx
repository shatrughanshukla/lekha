import { useState, useEffect } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import Dashboard from './components/Dashboard.jsx'
import CompanyView from './components/CompanyView.jsx'
import ProfileModal from './components/ProfileModal.jsx'
import { IconLekhaMark, IconSun, IconMoon } from './components/Shared.jsx'
import { useT } from './i18n.jsx'
import { api } from './api.js'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lekha_token') || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lekha_user')
    return raw ? JSON.parse(raw) : null
  })
  const [company, setCompany] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('lekha_theme') || 'dark')
  const [showProfile, setShowProfile] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const { t, lang, setLang } = useT()

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

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

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
    setAvatarBroken(false)
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
    setCompany(null)
  }

  if (!token || !user) {
    return <AuthScreen onAuthed={handleAuthed} />
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="wordmark small"><IconLekhaMark />Lekha</div>
        <div className="top-bar-right">
          <button className="lang-toggle" onClick={toggleLang} title={t('lang_switch_title')}>
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('theme_to_light') : t('theme_to_dark')}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button className="user-name-btn" onClick={() => setShowProfile(true)} title={t('edit_profile')}>
            {user.profile_picture_url && !avatarBroken ? (
              <img
                src={user.profile_picture_url}
                alt={user.name}
                className="user-avatar-sm"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <span className="user-avatar-sm user-avatar-fallback">{user.name?.[0]?.toUpperCase() || '?'}</span>
            )}
            <span className="user-name">{user.name}</span>
          </button>
          <button className="btn-ghost" onClick={signOut}>
            {t('sign_out')}
          </button>
        </div>
      </header>

      {showProfile && (
        <ProfileModal
          token={token}
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={handleProfileUpdated}
        />
      )}

      {company ? (
        <CompanyView token={token} user={user} company={company} onBack={() => setCompany(null)} />
      ) : (
        <Dashboard token={token} user={user} onOpenCompany={setCompany} />
      )}
    </div>
  )
}
