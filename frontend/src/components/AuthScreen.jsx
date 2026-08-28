import { useState } from 'react'
import { api } from '../api.js'
import { ErrorNote, IconLekhaMark } from './Shared.jsx'

const PRINCIPLES = [
  'Keep every bank and cash account, across every company you run, in one place.',
  'Move money between accounts and track its status from pending to completed.',
  'Type something like "pending transfers over 5000" into search to filter instantly.',
]

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = mode === 'signin' ? await api.signIn(email, password) : await api.signUp(name, email, password)
      onAuthed(data.token, data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="ruled-lines" aria-hidden="true" />
        <div className="margin-rule" aria-hidden="true" />
        <div className="hero-content">
          <div className="wordmark hero-wordmark"><IconLekhaMark width={64} height={64} />Lekha</div>
          <p className="hero-tagline">A ledger for money that moves — built to be read, not just trusted.</p>
          <ul className="hero-principles">
            {PRINCIPLES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="tab-row">
            <button className={mode === 'signin' ? 'tab active' : 'tab'} onClick={() => setMode('signin')}>
              Sign in
            </button>
            <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>
              Sign up
            </button>
          </div>

          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>

            <ErrorNote message={error} />

            <button type="submit" className="btn-primary full" disabled={loading}>
              {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
