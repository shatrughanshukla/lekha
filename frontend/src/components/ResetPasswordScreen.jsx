import { useState } from 'react'
import { api } from '../api.js'
import { ErrorNote, IconLekhaMark } from './Shared.jsx'
import { useT } from '../i18n.jsx'

// Rendered instead of the normal auth screen whenever the URL has a
// ?reset_token= — this is where the link in the password-reset email
// lands. Deliberately shown regardless of whether this browser happens to
// already be signed in as someone: the token itself is the authority here,
// not the current session.
export default function ResetPasswordScreen({ token, onDone }) {
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { t } = useT()

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || t('invalid_reset_link_msg'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-form-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="auth-card">
          <div className="wordmark small" style={{ marginBottom: 22, justifyContent: 'center' }}>
            <IconLekhaMark />Lekha
          </div>

          {success ? (
            <>
              <p className="password-success-note">{t('reset_password_success_msg')}</p>
              <button className="btn-primary full" onClick={onDone}>
                {t('back_to_sign_in')}
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <h3 className="profile-section-title" style={{ marginBottom: 16 }}>{t('reset_password_title')}</h3>
              <label>
                {t('new_password_field_label')}
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  autoFocus
                />
              </label>

              <ErrorNote message={error} />

              <button type="submit" className="btn-primary full" disabled={loading}>
                {loading ? t('working') : t('reset_password_btn')}
              </button>
              <button type="button" className="link-btn small" style={{ marginTop: 14 }} onClick={onDone}>
                {t('back_to_sign_in')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
