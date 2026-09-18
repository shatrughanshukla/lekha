import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid, Wallet, ArrowLeftRight, ListOrdered, MessageCircle,
  BarChart3, Settings, Sun, Moon, ChevronsLeft, ChevronsRight, X,
} from 'lucide-react'
import { useT } from '../i18n.jsx'
import {
  useMotionVariants, useMediaQuery, MOBILE_QUERY,
  railVariants, sidebarLabelVariants, drawerVariants, backdropVariants,
  listVariants, listItemVariants, iconButtonVariants, layoutSpring,
} from '../motion/index.js'

const NAV_ITEMS = [
  { to: '/app', label: 'nav_dashboard', icon: LayoutGrid, end: true },
  { to: '/app/accounts', label: 'nav_accounts', icon: Wallet },
  { to: '/app/transfers', label: 'nav_transfers', icon: ArrowLeftRight },
  { to: '/app/transactions', label: 'nav_transactions', icon: ListOrdered },
  { to: '/app/assistant', label: 'nav_assistant', icon: MessageCircle },
  { to: '/app/reports', label: 'nav_reports', icon: BarChart3 },
]

/**
 * A single nav row.
 *
 * The active state is a shared-layout element: one `motion.span` with a
 * constant `layoutId` exists across the whole nav, so React removes it
 * from the old row and mounts it in the new one while Framer animates the
 * gap between them. That's what produces the indicator *sliding* between
 * items instead of blinking out here and in there — and it costs one
 * element, not per-item animation state.
 */
function NavItem({ item, collapsed, showLabels, onNavigate, t }) {
  const { to, label, icon: Icon, end } = item
  const labelVariants = useMotionVariants(sidebarLabelVariants)

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
      title={collapsed ? t(label) : undefined}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="sidebar-active-bg"
              transition={layoutSpring}
            />
          )}
          <span className="sidebar-nav-inner">
            <Icon size={17} strokeWidth={2} />
            <AnimatePresence initial={false}>
              {showLabels && (
                <motion.span
                  className="sidebar-nav-label"
                  variants={labelVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {t(label)}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </>
      )}
    </NavLink>
  )
}

/**
 * Sidebar in two genuinely different modes:
 *
 *   desktop — a rail that animates between 244px and 76px and remembers
 *             which it was via localStorage
 *   mobile  — an overlay drawer with a backdrop, scroll lock, Escape to
 *             close, and auto-close on navigate
 *
 * These are separate render paths rather than one element styled two ways,
 * because the animated property differs (width vs. x) and an inline width
 * left over from desktop would otherwise fight the drawer's own layout.
 */
export default function Sidebar({
  theme, onSetTheme, onOpenSettings,
  collapsed, onToggleCollapsed,
  mobileOpen, onCloseMobile,
}) {
  const { t } = useT()
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const rail = useMotionVariants(railVariants)
  const drawer = useMotionVariants(drawerVariants)
  const backdrop = useMotionVariants(backdropVariants)
  const navList = useMotionVariants(listVariants)
  const navItem = useMotionVariants(listItemVariants)
  const labelVariants = useMotionVariants(sidebarLabelVariants)

  // Labels show whenever there's room: always in the drawer, and on
  // desktop only while expanded.
  const showLabels = isMobile || !collapsed

  // Escape closes the drawer, and the body is locked while it's open so
  // the page behind doesn't scroll under the overlay.
  useEffect(() => {
    if (!isMobile || !mobileOpen) return

    const onKey = (e) => { if (e.key === 'Escape') onCloseMobile() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isMobile, mobileOpen, onCloseMobile])

  const navSection = (
    <motion.nav
      className="sidebar-nav"
      variants={navList}
      initial="initial"
      animate="animate"
    >
      {NAV_ITEMS.map((item) => (
        <motion.div key={item.to} variants={navItem}>
          <NavItem
            item={item}
            collapsed={collapsed && !isMobile}
            showLabels={showLabels}
            onNavigate={isMobile ? onCloseMobile : undefined}
            t={t}
          />
        </motion.div>
      ))}

      <motion.div variants={navItem}>
        <button
          className="sidebar-nav-item"
          onClick={() => { onOpenSettings(); if (isMobile) onCloseMobile() }}
          title={collapsed && !isMobile ? t('settings_nav') : undefined}
        >
          <span className="sidebar-nav-inner">
            <Settings size={17} strokeWidth={2} />
            <AnimatePresence initial={false}>
              {showLabels && (
                <motion.span
                  className="sidebar-nav-label"
                  variants={labelVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {t('settings_nav')}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </button>
      </motion.div>
    </motion.nav>
  )

  const themePill = (
    <div className="sidebar-theme-pill" role="group" aria-label={t('theme_light') + ' / ' + t('theme_dark')}>
      {[
        { key: 'light', icon: Sun, label: t('theme_light') },
        { key: 'dark', icon: Moon, label: t('theme_dark') },
      ].map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          className={theme === key ? 'active' : ''}
          onClick={() => onSetTheme(key)}
          aria-pressed={theme === key}
        >
          {/* The selected pill is another shared-layout element — it
              slides between the two options rather than the background
              simply swapping sides. */}
          {theme === key && (
            <motion.span
              layoutId="theme-pill"
              className="sidebar-theme-pill-bg"
              transition={layoutSpring}
            />
          )}
          <span className="sidebar-theme-pill-label">
            <Icon size={14} /> {label}
          </span>
        </button>
      ))}
    </div>
  )

  // ---------------------------------------------------------------- mobile
  if (isMobile) {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="sidebar-backdrop"
              variants={backdrop}
              initial="closed"
              animate="open"
              exit="closed"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            <motion.aside
              className="sidebar sidebar-drawer"
              variants={drawer}
              initial="closed"
              animate="open"
              exit="closed"
              role="dialog"
              aria-modal="true"
              aria-label={t('nav_dashboard')}
            >
              <div className="sidebar-drawer-head">
                <div className="sidebar-logo"><span>Lekha</span></div>
                <motion.button
                  className="sidebar-icon-btn"
                  onClick={onCloseMobile}
                  variants={iconButtonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  aria-label={t('dismiss')}
                >
                  <X size={18} />
                </motion.button>
              </div>
              {navSection}
              {themePill}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    )
  }

  // --------------------------------------------------------------- desktop
  return (
    <motion.aside
      className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}
      variants={rail}
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
    >
      <div className="sidebar-logo">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={collapsed ? 'mark' : 'word'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className={collapsed ? 'sidebar-logo-collapsed' : undefined}
          >
            {collapsed ? 'L' : 'Lekha'}
          </motion.span>
        </AnimatePresence>
      </div>

      {navSection}

      <motion.button
        className="sidebar-icon-btn sidebar-collapse-btn"
        onClick={onToggleCollapsed}
        variants={iconButtonVariants}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        title={collapsed ? t('expand_sidebar') : t('collapse_sidebar')}
        aria-label={collapsed ? t('expand_sidebar') : t('collapse_sidebar')}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
      </motion.button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            variants={sidebarLabelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {themePill}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
