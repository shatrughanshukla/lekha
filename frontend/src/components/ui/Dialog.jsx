import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// New shared modal primitive for future phases to adopt (existing modals —
// ProfileModal, TransferDetail — keep their own implementation for now,
// per "don't redesign pages yet"; this is the one new pages/features in
// later phases should reach for instead of hand-rolling another modal).
export default function Dialog({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ui-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className={`ui-dialog ui-dialog-${size}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-dialog-header">
              <h2>{title}</h2>
              <button className="ui-dialog-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="ui-dialog-body">{children}</div>
            {footer && <div className="ui-dialog-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
