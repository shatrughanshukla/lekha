import { useState } from 'react'
import { api } from '../api.js'
import { ErrorNote, IconLekhaMark } from './Shared.jsx'
import { useT } from '../i18n.jsx'

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { t, lang, setLang } = useT()

  const PRINCIPLES = [t('principle_1'), t('principle_2'), t('principle_3')]

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = mode === 'signin' ? await api.signIn(email, password) : await api.signUp(name, email, password)
      onAuthed(data.token, data.user, mode)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitForgotPassword(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.forgotPassword(email)
      setResetSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function goToForgotPassword() {
    setError('')
    setResetSent(false)
    setMode('forgot')
  }

  function backToSignIn() {
    setError('')
    setResetSent(false)
    setMode('signin')
  }

  return (
    <div className="auth-page">
      <button
        type="button"
        className="lang-toggle auth-lang-toggle"
        onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
        title={t('lang_switch_title')}
      >
        {lang === 'en' ? 'हिं' : 'EN'}
      </button>
      <div className="auth-hero">
        <div className="ruled-lines" aria-hidden="true" />
        <div className="margin-rule" aria-hidden="true" />
        <div className="hero-content">
          <div className="wordmark hero-wordmark"><IconLekhaMark width={64} height={64} />Lekha</div>
          <p className="hero-tagline">{t('tagline')}</p>
          <ul className="hero-principles">
            {PRINCIPLES.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          {mode === 'forgot' ? (
            resetSent ? (
              <>
                <p className="password-success-note">{t('reset_link_sent_msg')}</p>
                <button className="btn-ghost full" onClick={backToSignIn}>
                  {t('back_to_sign_in')}
                </button>
              </>
            ) : (
              <form onSubmit={submitForgotPassword}>
                <p className="panel-hint" style={{ marginBottom: 16 }}>{t('reset_password_email_label')}</p>
                <label>
                  {t('email_label')}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </label>

                <ErrorNote message={error} />

                <button type="submit" className="btn-primary full" disabled={loading}>
                  {loading ? t('working') : t('send_reset_link')}
                </button>
                <button type="button" className="link-btn small" style={{ marginTop: 14 }} onClick={backToSignIn}>
                  {t('back_to_sign_in')}
                </button>
              </form>
            )
          ) : (
            <>
              <div className="tab-row">
                <button className={mode === 'signin' ? 'tab active' : 'tab'} onClick={() => setMode('signin')}>
                  {t('sign_in')}
                </button>
                <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>
                  {t('sign_up')}
                </button>
              </div>

              <form onSubmit={submit}>
                {mode === 'signup' && (
                  <label>
                    {t('name_label')}
                    <input value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                )}
                <label>
                  {t('email_label')}
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label>
                  {t('password_label')}
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </label>

                <ErrorNote message={error} />

                <button type="submit" className="btn-primary full" disabled={loading}>
                  {loading ? t('working') : mode === 'signin' ? t('sign_in') : t('create_account_btn')}
                </button>
                {mode === 'signin' && (
                  <button type="button" className="link-btn small" style={{ marginTop: 14 }} onClick={goToForgotPassword}>
                    {t('forgot_password_link')}
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
