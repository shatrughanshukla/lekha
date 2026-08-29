import { useState } from 'react'
import { api } from '../api.js'
import { Modal, ErrorNote } from './Shared.jsx'

// Lets a signed-in user view and edit their own name, email, and profile
// picture (given as an image URL — there's no file upload/storage wired up
// in this app, so a URL is the pragmatic way to set one for now).
export default function ProfileModal({ token, user, onClose, onUpdated }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [pictureUrl, setPictureUrl] = useState(user.profile_picture_url || '')
  const [imgError, setImgError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const updated = await api.updateUser(token, user.id, {
        name,
        email,
        profile_picture_url: pictureUrl || null,
      })
      onUpdated(updated)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const initials = name?.[0]?.toUpperCase() || '?'
  const showImage = pictureUrl && !imgError

  return (
    <Modal title="Your profile" onClose={onClose}>
      <div className="profile-avatar-row">
        {showImage ? (
          <img
            src={pictureUrl}
            alt={name}
            className="profile-avatar-lg"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="profile-avatar-lg profile-avatar-fallback">{initials}</div>
        )}
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
        <label>
          Profile picture URL
          <input
            placeholder="https://…"
            value={pictureUrl}
            onChange={(e) => { setPictureUrl(e.target.value); setImgError(false) }}
          />
        </label>
        <p className="panel-hint">Paste a link to an image — there's no photo upload yet, just a URL.</p>

        <ErrorNote message={error} />

        <button className="btn-primary full" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  )
}
