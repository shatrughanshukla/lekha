import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Menu } from 'lucide-react'
import { useT } from '../i18n.jsx'
import {
  useMotionVariants, useMediaQuery, MOBILE_QUERY,
  iconButtonVariants, buttonVariants, easing,
} from '../motion/index.js'

/**
 * Header: flat surface, hairline bottom border, no glass and no shadow —
 * it's a boundary, not a floating object.
 *
 * All the personality here is in the micro-interactions on the controls
 * themselves (press compression, icon swap) rather than in the bar's own
 * styling, which keeps it quiet while the page below it changes.
 */
export default function Topbar({
  user, lang, onToggleLang,
  avatarBroken, onAvatarError, onOpenProfile, onSignOut,
  onOpenMobileNav,
}) {
  const { t } = useT()
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const iconBtn = useMotionVariants(iconButtonVariants)
  const btn = useMotionVariants(buttonVariants)

  return (
    <header className="top-bar">
      {isMobile && (
        <motion.button
          className="top-bar-icon-btn top-bar-menu-btn"
          onClick={onOpenMobileNav}
          variants={iconBtn}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          aria-label={t('nav_dashboard')}
        >
          <Menu size={18} />
        </motion.button>
      )}

      <div className="top-bar-right">
        <motion.button
          className="top-bar-icon-btn lang-toggle"
          onClick={onToggleLang}
          variants={iconBtn}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          title={t('lang_switch_title')}
        >
          {/* The label cross-fades rather than snapping, so the toggle
              reads as one control changing state. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={lang}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12, ease: easing.out }}
            >
              {lang === 'en' ? 'हिं' : 'EN'}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <motion.button
          className="user-name-btn"
          onClick={onOpenProfile}
          variants={btn}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          title={t('edit_profile')}
          aria-label={`${t('edit_profile')}: ${user.name}`}
        >
          {user.profile_picture_url && !avatarBroken ? (
            <img
              src={user.profile_picture_url}
              alt={user.name}
              className="user-avatar-sm"
              onError={onAvatarError}
            />
          ) : (
            <span className="user-avatar-sm user-avatar-fallback">
              {user.name?.[0]?.toUpperCase() || '?'}
            </span>
          )}
          <span className="user-name">{user.name}</span>
        </motion.button>

        <motion.button
          className="ui-btn ui-btn-secondary ui-btn-sm"
          onClick={onSignOut}
          variants={btn}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
        >
          <LogOut size={15} /> <span className="top-bar-signout-label">{t('sign_out')}</span>
        </motion.button>
      </div>
    </header>
  )
}
