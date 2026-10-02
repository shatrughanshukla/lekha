import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useT } from '../i18n.jsx'
import Dialog from './ui/Dialog.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import { ErrorNote } from './Shared.jsx'

// Rename / delete a company. Both are admin-only on the server and both make
// the admin type their password again, so a session left open on a shared
// machine can't be used to rename or remove a company.
//
// `target` is null (closed) or { mode: 'rename' | 'delete', company }.
export default function CompanyActionDialog({ target, token, onClose, onDone }) {
  const { t } = useT()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Keep showing the last target while the dialog animates closed.
  const lastTarget = useRef(null)
  if (target) lastTarget.current = target
  const shown = target || lastTarget.current

  useEffect(() => {
    if (target) {
      setName(target.company.company_name)
      setPassword('')
      setError('')
      setBusy(false)
    }
  }, [target])

  if (!shown) return null
  const { mode, company } = shown
  const isDelete = mode === 'delete'

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      if (isDelete) await api.deleteCompany(token, company.id, password)
      else await api.updateCompany(token, company.id, name.trim(), password)
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const unchanged = !isDelete && name.trim() === company.company_name
  const canSubmit = !!password && (isDelete || (!!name.trim() && !unchanged))

  return (
    <Dialog
      open={!!target}
      onClose={busy ? undefined : onClose}
      title={isDelete ? t('company_delete_title') : t('company_rename_title')}
      size="sm"
    >
      <form onSubmit={submit} className="company-action-form">
        {isDelete ? (
          <p className="company-action-warning">{t('company_delete_warning', { name: company.company_name })}</p>
        ) : (
          <Input
            label={t('company_name_label')}
            name="company_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={120}
          />
        )}
        <Input
          label={t('confirm_with_password')}
          hint={t('confirm_password_hint')}
          name="confirm_password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={isDelete}
        />
        <ErrorNote message={error} />
        <div className="company-action-buttons">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>{t('cancel')}</Button>
          <Button type="submit" variant={isDelete ? 'danger' : 'primary'} loading={busy} disabled={!canSubmit}>
            {isDelete ? t('company_delete') : t('company_save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
