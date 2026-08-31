import { useRef, useState } from 'react'
import { api } from '../api.js'
import { Modal, ErrorNote, IconCamera } from './Shared.jsx'
import { useT } from '../i18n.jsx'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // keep in sync with the backend's limit
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Lets a signed-in user view and edit their name/email/language, and
// upload a real profile photo from their device (stored in Supabase
// Storage on the backend — see POST /users/:id/profile-picture).
export default function ProfileModal({ token, user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [pictureUrl, setPictureUrl] = useState(user.profile_picture_url || '')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const { t, lang, setLang } = useT()

  const initials = name?.[0]?.toUpperCase() || '?'
  const displayedImage = previewUrl || pictureUrl

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked again later if needed
    if (!file) return

    setError('')

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('invalid_image_type'))
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(t('image_too_large'))
      return
    }

    // Show it immediately, before the upload even finishes.
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setUploading(true)

    try {
      const updated = await api.uploadProfilePicture(token, user.id, file)
      setPictureUrl(updated.profile_picture_url || '')
      onUpdated(updated)
    } catch (err) {
      setError(err.message)
      setPreviewUrl('') // fall back rather than showing a photo that failed to save
    } finally {
      setUploading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  async function handleRemovePhoto() {
    setError('')
    setUploading(true)
    try {
      const updated = await api.removeProfilePicture(token, user.id)
      setPictureUrl('')
      setPreviewUrl('')
      onUpdated(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleLangChange(e) {
    const next = e.target.value
    setLang(next)
    try {
      const updated = await api.updateUser(token, user.id, { preferred_language: next })
      onUpdated(updated)
    } catch (err) {
      // Language still switches locally even if the profile save fails —
      // don't block the UI language change over a network hiccup.
      setError(err.message)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await api.updateUser(token, user.id, { name, email })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('your_profile_title')} onClose={onClose}>
      <div className="profile-avatar-row">
        <div className="profile-avatar-wrap">
          {displayedImage ? (
            <img src={displayedImage} alt={name} className="profile-avatar-lg" />
          ) : (
            <div className="profile-avatar-lg profile-avatar-fallback">{initials}</div>
          )}
          {uploading && <div className="profile-avatar-spinner" aria-label={t('saving')} />}
          <button
            type="button"
            className="profile-avatar-edit-btn"
            onClick={openFilePicker}
            disabled={uploading}
            title={t('change_photo')}
          >
            <IconCamera width={15} height={15} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div className="profile-avatar-actions">
          <button type="button" className="link-btn small" onClick={openFilePicker} disabled={uploading}>
            {displayedImage ? t('change_photo') : t('upload_photo')}
          </button>
          {displayedImage && (
            <button type="button" className="link-btn small danger" onClick={handleRemovePhoto} disabled={uploading}>
              {t('remove')}
            </button>
          )}
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSave}>
        <label>
          {t('name_label')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {t('email_label')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          {t('language_label')}
          <select value={lang} onChange={handleLangChange}>
            <option value="en">{t('lang_name_en')}</option>
            <option value="hi">{t('lang_name_hi')}</option>
          </select>
        </label>

        <ErrorNote message={error} />

        <button className="btn-primary full" type="submit" disabled={saving}>
          {saving ? t('saving') : t('save_changes')}
        </button>
      </form>
    </Modal>
  )
}
