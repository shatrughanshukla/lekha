import { useState } from 'react'
import { useT } from '../i18n.jsx'

// ---------------------------------------------------------------------------
// Icons — small stroke-based line icons, no external icon library.
// ---------------------------------------------------------------------------

const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }

// The Lekha mark: an open book/ledger in a flat rounded square, in the
// brand accent color. Matches the professional reference style directly —
// a solid icon-square, not a decorative gradient shape.
export const IconLekhaMark = ({ width = 26, height = 26, ...p }) => (
  <svg width={width} height={height} viewBox="0 0 32 32" fill="none" {...p}>
    <rect width="32" height="32" rx="9" fill="var(--violet)" />
    <path
      d="M16 12.5c-1.5-1.3-3.4-2-5.5-2-.8 0-1.5.6-1.5 1.4v8.6c0 .8.7 1.4 1.5 1.4 2.1 0 4 .7 5.5 2 1.5-1.3 3.4-2 5.5-2 .8 0 1.5-.6 1.5-1.4v-8.6c0-.8-.7-1.4-1.5-1.4-2.1 0-4 .7-5.5 2z"
      fill="none"
      stroke="var(--on-brand)"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M16 12.5v9.6" stroke="var(--on-brand)" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

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
export const IconSun = (p) => (
  <svg {...iconProps} {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.85 1.85M17.55 17.55l1.85 1.85M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.85-1.85M17.55 6.45l1.85-1.85" /></svg>
)
export const IconMoon = (p) => (
  <svg {...iconProps} {...p}><path d="M20 14.5A8.5 8.5 0 1110 3.2 6.8 6.8 0 0020 14.5z" /></svg>
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
export const IconGrid = (p) => (
  <svg {...iconProps} {...p}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
)
export const IconWallet = (p) => (
  <svg {...iconProps} {...p}><path d="M3 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /><path d="M16 12h3" /><path d="M3 9h18" /></svg>
)
export const IconSwap = (p) => (
  <svg {...iconProps} {...p}><path d="M4 8h13M17 8l-3.5-3.5M17 8l-3.5 3.5" /><path d="M20 16H7M7 16l3.5-3.5M7 16l3.5 3.5" /></svg>
)
export const IconList = (p) => (
  <svg {...iconProps} {...p}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
export const IconChart = (p) => (
  <svg {...iconProps} {...p}><path d="M4 20V10M11 20V4M18 20v-7" /><path d="M3 20h18" /></svg>
)
export const IconSettings = (p) => (
  <svg {...iconProps} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
)
export const IconLogout = (p) => (
  <svg {...iconProps} {...p}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
)
export const IconCheck = (p) => (
  <svg {...iconProps} {...p}><path d="M4 12l5 5L20 6" /></svg>
)
export const IconCamera = (p) => (
  <svg {...iconProps} {...p}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
    <circle cx="12" cy="14" r="3.5" />
  </svg>
)
export const IconChat = (p) => (
  <svg {...iconProps} {...p}>
    <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-4-1L3 20l1.1-3.9A8.5 8.5 0 1121 11.5z" />
  </svg>
)
export const IconSend = (p) => (
  <svg {...iconProps} {...p}>
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
)

// ---------------------------------------------------------------------------
// Money / status
// ---------------------------------------------------------------------------

export function Money({ value }) {
  return <span className="money">₹{Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
}

export function StampBadge({ status, color }) {
  const { t } = useT()
  return (
    <span className="stamp" style={{ borderColor: color, color }}>
      {t(`status_${status}`)}
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

export function DeleteButton({ onConfirm, labelKey = 'delete_account_label' }) {
  const [armed, setArmed] = useState(false)
  const { t } = useT()
  const label = t(labelKey)

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
        {t('confirm_delete', { label })}
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

// ---------------------------------------------------------------------------
// A button that copies a full ID to the clipboard, showing a checkmark and
// "Copied" in place of the truncated ID for a moment so the click actually
// feels like it did something — plain navigator.clipboard.writeText() gives
// no feedback at all otherwise.
// ---------------------------------------------------------------------------

export function CopyableID({ id, className = '', chars = 8 }) {
  const [copied, setCopied] = useState(false)
  const { t } = useT()

  async function handleCopy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can fail (permissions, insecure context, etc.) —
      // fail quietly rather than showing a false "Copied".
    }
  }

  return (
    <button type="button" className={`copyable-id mono ${className}`} title={t('click_to_copy')} onClick={handleCopy}>
      {copied ? (
        <span className="copyable-id-copied"><IconCheck width={12} height={12} /> {t('copied')}</span>
      ) : (
        <>{id.slice(0, chars)}… ⧉</>
      )}
    </button>
  )
}
