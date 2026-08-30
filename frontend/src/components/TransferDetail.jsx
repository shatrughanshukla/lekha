import { useState, useEffect } from 'react'
import { api, STATUS_COLORS } from '../api.js'
import { Modal, Money, StampBadge, ErrorNote } from './Shared.jsx'

export default function TransferDetail({ token, user, company, transferId, onClose, onChanged }) {
  const [t, setT] = useState(null)
  const [error, setError] = useState('')
  const [acting, setActing] = useState(false)

  useEffect(() => {
    api.getTransfer(token, transferId)
      .then(setT)
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferId])

  async function respond(approve) {
    setActing(true)
    setError('')
    try {
      const updated = await api.respondToTransfer(token, transferId, approve, user.id)
      setT((prev) => ({ ...prev, ...updated }))
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setActing(false)
    }
  }

  async function proposeReversal() {
    setActing(true)
    setError('')
    try {
      const updated = await api.proposeTransferReversal(token, transferId, user.id)
      setT((prev) => ({ ...prev, ...updated }))
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setActing(false)
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
              <StampBadge status={t.status} color={STATUS_COLORS[t.status]} />
            </span>
          </div>

          <ApprovalArea t={t} company={company} acting={acting} onRespond={respond} onPropose={proposeReversal} />
        </div>
      )}
    </Modal>
  )
}

// Shows whatever action (if any) the CURRENT company can take on this
// transfer right now — approving/rejecting a brand-new request, waiting on
// the other side, proposing a reversal, or nothing at all once a transfer
// has reached a terminal state (CANCELLED/REVERSED).
function ApprovalArea({ t, company, acting, onRespond, onPropose }) {
  const isSenderSide = company.id === t.company_id

  if (t.status === 'PENDING') {
    if (isSenderSide) {
      return (
        <div className="approval-banner">
          <p className="panel-hint">Waiting for the receiving company to approve this transfer. No money has moved yet.</p>
          <button className="btn-ghost small" disabled={acting} onClick={() => onRespond(false)}>
            {acting ? '…' : 'Cancel request'}
          </button>
        </div>
      )
    }
    return (
      <div className="approval-banner">
        <p className="panel-hint">This transfer needs your approval before any money moves.</p>
        <div className="approval-actions">
          <button className="btn-primary small" disabled={acting} onClick={() => onRespond(true)}>
            {acting ? '…' : 'Approve'}
          </button>
          <button className="btn-ghost small" disabled={acting} onClick={() => onRespond(false)}>
            Reject
          </button>
        </div>
      </div>
    )
  }

  if (t.status === 'COMPLETED' && t.pending_status) {
    const iProposed = t.proposed_by_company_id === company.id
    if (iProposed) {
      return (
        <div className="approval-banner">
          <p className="panel-hint">
            {t.proposed_by_name ? `${t.proposed_by_name} proposed` : 'You proposed'} reversing this transfer.
            Waiting for the other company to respond — the money hasn't moved.
          </p>
        </div>
      )
    }
    return (
      <div className="approval-banner">
        <p className="panel-hint">The other company wants to reverse this transfer.</p>
        <div className="approval-actions">
          <button className="btn-primary small" disabled={acting} onClick={() => onRespond(true)}>
            {acting ? '…' : 'Approve reversal'}
          </button>
          <button className="btn-ghost small" disabled={acting} onClick={() => onRespond(false)}>
            Reject
          </button>
        </div>
      </div>
    )
  }

  if (t.status === 'COMPLETED') {
    return (
      <div className="approval-banner">
        <button className="link-btn small danger" disabled={acting} onClick={onPropose}>
          {acting ? '…' : 'Propose reversing this transfer'}
        </button>
      </div>
    )
  }

  return null
}
