import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react'
import { useMotionVariants, modalVariants, modalBackdropVariants } from '../motion/index.js'
import { staticCommands, collectDynamicCommands } from '../commands/registry.js'
import { useT } from '../i18n.jsx'
// Side-effect import: registers the built-in providers (companies, …)
// exactly once at module load. See commands/providers.js.
import '../commands/providers.js'

/** Case-insensitive substring match across label + keywords. Simple on
 * purpose — a palette with a handful of commands doesn't need a scoring
 * fuzzy-match library; it needs to never feel slow opening. */
function matches(command, query) {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    command.label.toLowerCase().includes(q) ||
    command.group.toLowerCase().includes(q) ||
    (command.keywords || []).some((k) => k.toLowerCase().includes(q))
  )
}

/**
 * Global Cmd/Ctrl+K palette, mounted once in AppShell.
 *
 * Deliberately owns its own open/close and keyboard state rather than
 * taking `open` as a prop — every page should get the same shortcut for
 * free without wiring anything, which is the whole point of a *global*
 * palette.
 */
export default function CommandPalette({ context = {} }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()
  const { t } = useT()
  const backdrop = useMotionVariants(modalBackdropVariants)
  const panel = useMotionVariants(modalVariants)

  const ctx = useMemo(() => ({ navigate, t, ...context }), [navigate, t, context])

  const allCommands = useMemo(() => {
    if (!open) return []
    return [...staticCommands(ctx), ...collectDynamicCommands(ctx)]
  }, [open, ctx])

  const filtered = useMemo(
    () => allCommands.filter((c) => matches(c, query)),
    [allCommands, query]
  )

  const grouped = useMemo(() => {
    const groups = new Map()
    for (const c of filtered) {
      if (!groups.has(c.group)) groups.set(c.group, [])
      groups.get(c.group).push(c)
    }
    return Array.from(groups.entries())
  }, [filtered])

  const close = useCallback(() => { setOpen(false); setQuery(''); setActiveIndex(0) }, [])

  function run(command) {
    close()
    // Runs after close() has queued its state update — the command may
    // itself trigger a route change, and we don't want the palette to
    // still be in the DOM (and stealing focus) when that lands.
    requestAnimationFrame(() => command.perform())
  }

  // Global shortcut: Cmd+K on macOS, Ctrl+K elsewhere. "/" is intentionally
  // NOT bound — it would fire while typing in any ordinary text field.
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape' && open) {
        close()
      }
    }
    function onExternalOpen() { setOpen(true) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('lekha:open-command-palette', onExternalOpen)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('lekha:open-command-palette', onExternalOpen)
    }
  }, [open, close])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => { setActiveIndex(0) }, [query])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector('.command-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) run(filtered[activeIndex])
    }
  }

  let runningIndex = -1

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="command-backdrop"
            variants={backdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={close}
          />
          <motion.div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label={t('command_palette_label')}
            variants={panel}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="command-input-row">
              <Search size={16} className="command-input-icon" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('command_palette_placeholder')}
                aria-label={t('command_palette_label')}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd className="command-kbd">Esc</kbd>
            </div>

            <div className="command-list" ref={listRef} role="listbox">
              {filtered.length === 0 ? (
                <div className="command-empty">{t('command_palette_empty')}</div>
              ) : (
                grouped.map(([group, commands]) => (
                  <div className="command-group" key={group}>
                    <div className="command-group-label">{group}</div>
                    {commands.map((c) => {
                      runningIndex += 1
                      const idx = runningIndex
                      return (
                        <button
                          key={c.id}
                          role="option"
                          aria-selected={idx === activeIndex}
                          className={`command-item${idx === activeIndex ? ' active' : ''}`}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => run(c)}
                        >
                          <span className="command-item-label">{c.label}</span>
                          {c.hint && <span className="command-item-hint">{c.hint}</span>}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="command-footer">
              <span><ArrowUp size={11} /><ArrowDown size={11} /> {t('command_palette_navigate')}</span>
              <span><CornerDownLeft size={11} /> {t('command_palette_select')}</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
