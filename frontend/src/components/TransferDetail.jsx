import { useState, useEffect } from 'react'
import { api, TRANSFER_STATUSES, STATUS_COLORS } from '../api.js'
import { Modal, Money, StampBadge, ErrorNote } from './Shared.jsx'

export default function TransferDetail({ token, user, transferId, onClose, onChanged }) {
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getTransfer(token, transferId)
      .then((data) => { setT(data); setNewStatus(data.status) })
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId])

  async function saveStatus() {
    setSaving(true)
    setError('')
    try {
      const updated = await api.updateTransferStatus(token, transferId, newStatus, user.id)
      setT((prev) => ({ ...prev, status: updated.status, updated_at: updated.updated_at }))
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Transfer details" onClose={onClose}>
      <ErrorNote message={error} />
      {!t ? (
        <p className="panel-hint">Loading…</p>
      ) : (
        <div className="detail-grid">
          <div className="detail-row">
            <span className="detail-label">Amount</span>
            <span className="detail-value"><Money value={t.amount} /></span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Type</span>
            <span className="detail-value">{t.transfer_type}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">From</span>
            <span className="detail-value">
              {t.from_company_name} — {t.from_account_type}
              <div className="detail-sub mono">{t.from_account_id}</div>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">To</span>
            <span className="detail-value">
              {t.to_company_name} — {t.to_account_type}
              <div className="detail-sub mono">{t.to_account_id}</div>
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Note</span>
            <span className="detail-value">{t.transfer_notes || <em className="dim">none</em>}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Created</span>
            <span className="detail-value timestamp">
              {t.created_by_name} — {new Date(t.created_at).toLocaleString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Last updated</span>
            <span className="detail-value timestamp">
              {t.updated_by_name} — {new Date(t.updated_at).toLocaleString()}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Status</span>
            <span className="detail-value">
              <div className="status-editor">
                <StampBadge status={t.status} color={STATUS_COLORS[t.status]} />
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {TRANSFER_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
                <button
                  className="btn-primary small"
                  disabled={saving || newStatus === t.status}
                  onClick={saveStatus}
                >
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            </span>
          </div>
        </div>
      )}
    </Modal>
  )
}
