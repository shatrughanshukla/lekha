import { useState } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import Dashboard from './components/Dashboard.jsx'
import CompanyView from './components/CompanyView.jsx'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('lekha_token') || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('lekha_user')
    return raw ? JSON.parse(raw) : null
  })
  const [company, setCompany] = useState(null)

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
        <div className="wordmark small">Lekha</div>
        <div className="top-bar-right">
          <span className="user-name">{user.name}</span>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {company ? (
        <CompanyView token={token} user={user} company={company} onBack={() => setCompany(null)} />
      ) : (
        <Dashboard token={token} user={user} onOpenCompany={setCompany} />
      )}
    </div>
  )
}
