import { useState, useEffect } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import ProfileModal from './ProfileModal.jsx'
import { useT } from '../i18n.jsx'
import {
  useMotionVariants, useMediaQuery, MOBILE_QUERY,
  pageVariants, bannerVariants,
} from '../motion/index.js'

// The one place sidebar + topbar + cross-page banners (email verification,
// toast) live, so every route under /app automatically gets them via
// <Outlet/> instead of each page re-implementing its own shell. Redirects
// to "/" if there's no session — the single auth gate for the whole
// protected area, rather than each page checking token/user itself.
//
// Verify-banner state is owned by App.jsx, not here — the ?verify_token=
// effect that populates it runs at the very top of the app, before
// routing even resolves, so it can't live inside a route-gated component.
export default function AppShell({
  token, user, theme, setTheme, lang, toggleLang, onProfileUpdated, signOut,
  verifyBannerMsg, setVerifyBannerMsg, verifyBannerDismissed, setVerifyBannerDismissed,
  resendingVerification, resendVerification,
}) {
  const { t } = useT()
  const location = useLocation()
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [showProfile, setShowProfile] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('lekha_sidebar_collapsed') === '1')

  const page = useMotionVariants(pageVariants)
  const banner = useMotionVariants(bannerVariants)

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem('lekha_sidebar_collapsed', !c ? '1' : '0')
      return !c
    })
  }

  // Leaving mobile width with the drawer still open would otherwise strand
  // it open behind the desktop rail.
  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false)
  }, [isMobile])

  if (!token || !user) return <Navigate to="/" replace />

  return (
    <div className="app-shell">
      <Sidebar
        theme={theme}
        onSetTheme={setTheme}
        onOpenSettings={() => setShowProfile(true)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="main-column">
        <Topbar
          user={user}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          lang={lang}
          onToggleLang={toggleLang}
          avatarBroken={avatarBroken}
          onAvatarError={() => setAvatarBroken(true)}
          onOpenProfile={() => setShowProfile(true)}
          onSignOut={signOut}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />

        {showProfile && (
          <ProfileModal
            token={token}
            user={user}
            onClose={() => setShowProfile(false)}
            onUpdated={(u) => { onProfileUpdated(u); setAvatarBroken(false) }}
          />
        )}

        {/* Banners animate their height so the page below slides down to
            make room instead of being shoved. */}
        <AnimatePresence initial={false}>
          {verifyBannerMsg && (
            <motion.div
              key="toast"
              className={`toast-banner toast-${verifyBannerMsg.type}`}
              variants={banner}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {verifyBannerMsg.text}
              <button className="toast-dismiss" onClick={() => setVerifyBannerMsg(null)}>×</button>
            </motion.div>
          )}

          {!user.email_verified && !verifyBannerDismissed && (
            <motion.div
              key="verify"
              className="verify-banner"
              variants={banner}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <span>{t('verify_email_banner')}</span>
              <div className="verify-banner-actions">
                <button className="link-btn small" onClick={resendVerification} disabled={resendingVerification}>
                  {resendingVerification ? '…' : t('resend_verification_link')}
                </button>
                <button className="link-btn small" onClick={() => setVerifyBannerDismissed(true)}>
                  {t('dismiss')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* mode="wait" so the outgoing page finishes leaving before the
            next arrives — overlapping them makes both look like they're
            fighting for the same space. Keyed on pathname only (not
            search), so changing a filter that lives in the query string
            doesn't re-run the whole page transition. */}
        <main className="page-viewport">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={page}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
