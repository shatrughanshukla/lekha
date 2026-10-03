import { useState, useRef, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMotionVariants, duration, easing } from '../motion/index.js'

const menuVariants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: duration.fast, ease: easing.out } },
  exit: { opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } },
}

/**
 * A three-dot menu, rendered into a portal so it can never be clipped by
 * an ancestor's overflow:hidden (company cards, table rows) and always
 * sits above everything else on the page.
 *
 * `items`: [{ label, onSelect, danger?, disabled? }]. Fully keyboard
 * operable — Arrow keys move focus, Enter/Space activates, Escape closes
 * and returns focus to the trigger, matching native menu behaviour.
 */
export default function DropdownMenu({ trigger, items, align = 'end' }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const menuVars = useMotionVariants(menuVariants)
  const id = useId()

  function openMenu() {
    const rect = triggerRef.current.getBoundingClientRect()
    setCoords({
      top: rect.bottom + window.scrollY + 6,
      left: align === 'end' ? undefined : rect.left + window.scrollX,
      right: align === 'end' ? window.innerWidth - rect.right - window.scrollX : undefined,
    })
    setActiveIndex(-1)
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDocClick(e) {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return
      setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function onKeyDown(e) {
    const enabled = items.map((it, i) => ({ ...it, i })).filter((it) => !it.disabled)
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const pos = enabled.findIndex((it) => it.i === activeIndex)
      setActiveIndex(enabled[(pos + 1) % enabled.length]?.i ?? enabled[0]?.i)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const pos = enabled.findIndex((it) => it.i === activeIndex)
      setActiveIndex(enabled[(pos - 1 + enabled.length) % enabled.length]?.i ?? enabled[enabled.length - 1]?.i)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const item = items[activeIndex]
      if (item && !item.disabled) { item.onSelect(); setOpen(false); triggerRef.current?.focus() }
    }
  }

  return (
    <>
      <span
        className="dropdown-trigger"
        ref={triggerRef}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu() }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
      >
        {trigger}
      </span>

      {open && coords && createPortal(
        <AnimatePresence>
          <motion.div
            key="menu"
            id={id}
            ref={menuRef}
            role="menu"
            className="dropdown-menu"
            style={{ position: 'absolute', top: coords.top, left: coords.left, right: coords.right }}
            variants={menuVars}
            initial="initial"
            animate="animate"
            exit="exit"
            onKeyDown={onKeyDown}
            tabIndex={-1}
          >
            {items.map((item, i) => (
              <button
                key={item.label}
                role="menuitem"
                className={`dropdown-menu-item${item.danger ? ' danger' : ''}${activeIndex === i ? ' active' : ''}`}
                disabled={item.disabled}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={(e) => { e.stopPropagation(); item.onSelect(); setOpen(false); triggerRef.current?.focus() }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
