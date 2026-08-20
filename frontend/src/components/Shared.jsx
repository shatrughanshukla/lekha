import { useState } from 'react'

// ---------------------------------------------------------------------------
// Icons — small stroke-based line icons, no external icon library.
// ---------------------------------------------------------------------------

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconBank = (p) => (
  <svg {...iconProps} {...p}><path d="M3 10l9-6 9 6" /><path d="M5 10v9M9.5 10v9M14.5 10v9M19 10v9" /><path d="M3 21h18" /></svg>
)
export const IconCash = (p) => (
  <svg {...iconProps} {...p}><rect x="2.5" y="6" width="19" height="12" rx="1.5" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9h.01M18 15h.01" /></svg>
)
export const IconTrash = (p) => (
  <svg {...iconProps} {...p}><path d="M4 7h16" /><path d="M9 7V4.5A1.5 1.5 0 0110.5 3h3A1.5 1.5 0 0115 4.5V7" /><path d="M6 7l1 13a1.5 1.5 0 001.5 1.4h7a1.5 1.5 0 001.5-1.4L18 7" /><path d="M10 11v6M14 11v6" /></svg>
)
export const IconSearch = (p) => (
  <svg {...iconProps} {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.6-4.6" /></svg>
)
export const IconSparkle = (p) => (
  <svg {...iconProps} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
)
export const IconPlus = (p) => (
  <svg {...iconProps} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconArrowRight = (p) => (
  <svg {...iconProps} {...p}><path d="M4 12h16M14 6l6 6-6 6" /></svg>
)
export const IconBuilding = (p) => (
  <svg {...iconProps} {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></svg>
)
export const IconPeople = (p) => (
  <svg {...iconProps} {...p}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="7" r="2.5" /><path d="M15 13.2c2.6.4 4.5 2.6 5 6.8" /></svg>
)
export const IconInfo = (p) => (
  <svg {...iconProps} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></svg>
)
export const IconCrown = (p) => (
  <svg {...iconProps} {...p}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" /></svg>
)
export const IconClose = (p) => (
  <svg {...iconProps} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
)

// ---------------------------------------------------------------------------
// Money / status
// ---------------------------------------------------------------------------

export function Money({ value }) {
  return <span className="money">₹{Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
}

export function StampBadge({ status, color }) {
  return (
    <span className="stamp" style={{ borderColor: color, color }}>
      {status}
    </span>
  )
}

export function ErrorNote({ message }) {
  if (!message) return null
  return <div className="error-note">{message}</div>
}

// ---------------------------------------------------------------------------
// Modal — used by the transaction detail view.
// ---------------------------------------------------------------------------

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><IconClose /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Two-step delete — click once to arm, click again within a few seconds to
// confirm. Avoids the ugly native confirm() popup while still preventing
// accidental deletes.
// ---------------------------------------------------------------------------

export function DeleteButton({ onConfirm, label = 'Delete' }) {
  const [armed, setArmed] = useState(false)

  if (armed) {
    return (
      <button
        className="delete-btn armed"
        onClick={(e) => {
          e.stopPropagation()
          onConfirm()
          setArmed(false)
        }}
        onBlur={() => setArmed(false)}
      >
        Confirm {label.toLowerCase()}?
      </button>
    )
  }

  return (
    <button
      className="delete-btn"
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        setArmed(true)
        setTimeout(() => setArmed(false), 3000)
      }}
    >
      <IconTrash />
    </button>
  )
}
