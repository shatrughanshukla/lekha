import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  useMotionVariants,
  pageHeaderVariants,
  pageContentVariants,
} from '../motion/index.js'

/**
 * Remembered scroll offset per route, kept in module scope rather than
 * component state so it survives the page unmounting during a route
 * change — which is exactly when we need it.
 *
 * sessionStorage rather than localStorage: restoring yesterday's scroll
 * position on a fresh visit would be surprising, but restoring it when
 * you tab back from Reports to Transfers is what "nothing resets" means.
 */
const SCROLL_KEY = 'lekha_scroll_positions'

function readScrollMap() {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeScrollPosition(key, y) {
  try {
    const map = readScrollMap()
    map[key] = y
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map))
  } catch {
    // Private-mode Safari and friends — scroll memory is a nicety, never
    // worth breaking a page render over.
  }
}

/**
 * The shared frame every page under /app renders into.
 *
 * Centralising this means a new feature page gets the product's title
 * treatment, content width, padding rhythm, entrance cascade and scroll
 * memory by rendering one component — rather than by remembering to copy
 * a `<div className="page">` and a `<h1 className="page-title">` from a
 * neighbouring file and getting the spacing subtly wrong.
 *
 * Props:
 *   title       page heading (string or node)
 *   subtitle    optional line under the heading
 *   actions     optional right-hand slot: search, filters, primary button
 *   width       'default' (980px) | 'wide' (1240px) | 'full'
 *   padding     'default' | 'flush' (pages that own their own padding,
 *               e.g. the full-height assistant)
 *   restoreScroll  set false for pages that manage their own scrolling
 *   titleId     shared layout id, so a title can animate between routes
 */
export default function PageLayout({
  title,
  subtitle,
  actions,
  children,
  width = 'default',
  padding = 'default',
  restoreScroll = true,
  titleId,
  className = '',
}) {
  const location = useLocation()
  const headerVariants = useMotionVariants(pageHeaderVariants)
  const contentVariants = useMotionVariants(pageContentVariants)
  const scrollKey = location.pathname + location.search
  const scrollKeyRef = useRef(scrollKey)
  scrollKeyRef.current = scrollKey

  // Restore on mount, remember on unmount. Restoring happens after paint
  // (rAF) because the page's content hasn't been laid out yet on the
  // frame this component mounts — scrolling before that would clamp to a
  // document that's still only as tall as the header.
  useEffect(() => {
    if (!restoreScroll) return

    const saved = readScrollMap()[scrollKeyRef.current]
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: saved || 0, behavior: 'auto' })
    })

    const onScroll = () => writeScrollPosition(scrollKeyRef.current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      writeScrollPosition(scrollKeyRef.current, window.scrollY)
    }
  }, [restoreScroll])

  const hasHeader = title || subtitle || actions

  return (
    <div
      className={[
        'page-layout',
        `page-layout-${width}`,
        padding === 'flush' ? 'page-layout-flush' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {hasHeader && (
        <motion.header
          className="page-layout-head"
          variants={headerVariants}
          initial="initial"
          animate="animate"
        >
          <div className="page-layout-heading">
            {title && (
              <motion.h1 className="page-title" layoutId={titleId}>
                {title}
              </motion.h1>
            )}
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
          {actions && <div className="page-layout-actions">{actions}</div>}
        </motion.header>
      )}

      <motion.div
        className="page-layout-body"
        variants={contentVariants}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </div>
  )
}
