import { useState, useEffect } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import Dashboard from './components/Dashboard.jsx'
import CompanyView from './components/CompanyView.jsx'
import ProfileModal from './components/ProfileModal.jsx'
import { IconLekhaMark, IconSun, IconMoon } from './components/Shared.jsx'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lekha_token') || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lekha_user')
    return raw ? JSON.parse(raw) : null
  })
  const [company, setCompany] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('lekha_theme') || 'dark')
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lekha_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  function handleProfileUpdated(updatedUser) {
    localStorage.setItem('lekha_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  function handleAuthed(newToken, newUser) {
    localStorage.setItem('lekha_token', newToken)
    localStorage.setItem('lekha_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
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
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button className="user-name-btn" onClick={() => setShowProfile(true)} title="Edit your profile">
            {user.profile_picture_url ? (
              <img src={user.profile_picture_url} alt={user.name} className="user-avatar-sm" />
            ) : (
              <span className="user-avatar-sm user-avatar-fallback">{user.name?.[0]?.toUpperCase() || '?'}</span>
            )}
            <span className="user-name">{user.name}</span>
          </button>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
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
