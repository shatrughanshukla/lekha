import { useRef, useState } from 'react'
import { api } from '../api.js'
import { Modal, ErrorNote, IconCamera } from './Shared.jsx'

const MAX_FILE_BYTES = 5 * 1024 * 1024 // keep in sync with the backend's limit
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// Lets a signed-in user view and edit their name/email, and upload a real
// profile photo from their device (stored in Supabase Storage on the
// backend — see POST /users/:id/profile-picture).
export default function ProfileModal({ token, user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [pictureUrl, setPictureUrl] = useState(user.profile_picture_url || '')
  const [previewUrl, setPreviewUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

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
      setError('Please choose a JPEG, PNG, WEBP, or GIF image.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That image is too large — please choose one under 5MB.')
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
    <Modal title="Your profile" onClose={onClose}>
      <div className="profile-avatar-row">
        <div className="profile-avatar-wrap">
          {displayedImage ? (
            <img src={displayedImage} alt={name} className="profile-avatar-lg" />
          ) : (
            <div className="profile-avatar-lg profile-avatar-fallback">{initials}</div>
          )}
          {uploading && <div className="profile-avatar-spinner" aria-label="Uploading" />}
          <button
            type="button"
            className="profile-avatar-edit-btn"
            onClick={openFilePicker}
            disabled={uploading}
            title="Change photo"
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
            {displayedImage ? 'Change photo' : 'Upload photo'}
          </button>
          {displayedImage && (
            <button type="button" className="link-btn small danger" onClick={handleRemovePhoto} disabled={uploading}>
              Remove
            </button>
          )}
        </div>
      </div>

      <form className="profile-form" onSubmit={handleSave}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <ErrorNote message={error} />

        <button className="btn-primary full" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}
