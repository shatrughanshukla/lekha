import { useState } from 'react'
import { api } from '../api.js'
import { ErrorNote } from './Shared.jsx'

const PRINCIPLES = [
  'Every account, tracked to the rupee.',
  'Every transfer, locked and reconciled — never half-applied.',
  'Every question, answerable in plain English.',
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
          <div className="wordmark hero-wordmark">Lekha</div>
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
