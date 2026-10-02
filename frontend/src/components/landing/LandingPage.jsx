import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import {
  IconLekhaMark, IconSun, IconMoon, IconArrowRight, IconBuilding, IconSwap,
  IconCheck, IconChart, IconSparkle, IconChat,
} from '../Shared.jsx'
import ProductPreview from './ProductPreview.jsx'
import { useT } from '../../i18n.jsx'
import {
  useMotionVariants, pageHeaderVariants, pageContentVariants, staticCardVariants,
  listVariants, listItemVariants,
} from '../../motion/index.js'
import '../../styles/landing.css'

// Where the CTAs go. There was no separate sign-in route before this page
// existed (the auth screen lived at "/"), so the auth screen now lives at
// /auth and "Get started" opens it on the sign-up tab.
const SIGN_IN = '/auth'
const SIGN_UP = '/auth?mode=signup'

const NAV = [
  ['product', 'landing_nav_product'],
  ['features', 'landing_nav_features'],
  ['how-it-works', 'landing_nav_how'],
  ['security', 'landing_nav_security'],
]

const FEATURES = [
  { n: 1, icon: IconBuilding },
  { n: 2, icon: IconSwap },
  { n: 3, icon: IconCheck },
  { n: 4, icon: IconChart },
  { n: 5, icon: IconSparkle },
  { n: 6, icon: IconChat },
]

// -- motion helpers ---------------------------------------------------------
// Thin wrappers around the existing motion vocabulary (no new animation
// system): content fades/rises once as it enters the viewport. Variants go
// through useMotionVariants, so reduced-motion users get a plain cross-fade.

const VIEWPORT = { once: true, margin: '0px 0px -80px 0px' }

function Reveal({ variants = staticCardVariants, className, children }) {
  const v = useMotionVariants(variants)
  return (
    <motion.div className={className} variants={v} initial="initial" whileInView="animate" viewport={VIEWPORT}>
      {children}
    </motion.div>
  )
}

function RevealGroup({ className, as = 'div', children }) {
  const v = useMotionVariants(listVariants)
  const Tag = motion[as]
  return (
    <Tag className={className} variants={v} initial="initial" whileInView="animate" viewport={VIEWPORT}>
      {children}
    </Tag>
  )
}

function RevealItem({ className, as = 'div', children }) {
  const v = useMotionVariants(listItemVariants)
  const Tag = motion[as]
  return <Tag className={className} variants={v}>{children}</Tag>
}

function SectionHead({ eyebrow, title, lede, id }) {
  return (
    <Reveal className="lp-section-head">
      <p className="lp-eyebrow-text">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {lede && <p>{lede}</p>}
    </Reveal>
  )
}

export default function LandingPage({ theme, setTheme }) {
  const { t, lang, setLang } = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const heroHeader = useMotionVariants(pageHeaderVariants)
  const heroBody = useMotionVariants(pageContentVariants)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  const toggleLang = () => setLang(lang === 'en' ? 'hi' : 'en')

  const tools = (
    <>
      <button
        type="button"
        className="lp-icon-btn"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? t('theme_to_light') : t('theme_to_dark')}
        title={theme === 'dark' ? t('theme_to_light') : t('theme_to_dark')}
      >
        {theme === 'dark' ? <IconSun width={16} height={16} /> : <IconMoon width={16} height={16} />}
      </button>
      <button
        type="button"
        className="lp-icon-btn"
        onClick={toggleLang}
        aria-label={t('lang_switch_title')}
        title={t('lang_switch_title')}
      >
        {lang === 'en' ? 'हिं' : 'EN'}
      </button>
    </>
  )

  return (
    <div className="lp">
      <a className="lp-skip" href="#main">{t('landing_skip')}</a>

      {/* ------------------------------ NAV ------------------------------ */}
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Link to="/" className="lp-brand" aria-label="Lekha">
            <span className="wordmark small"><IconLekhaMark width={26} height={26} />Lekha</span>
          </Link>

          <nav className="lp-nav" aria-label={t('landing_nav_label')}>
            {NAV.map(([id, key]) => <a key={id} href={`#${id}`}>{t(key)}</a>)}
          </nav>

          <div className="lp-header-actions">
            <div className="lp-tools">{tools}</div>
            <Link to={SIGN_IN} className="ui-btn ui-btn-ghost ui-btn-sm lp-signin">{t('sign_in')}</Link>
            <Link to={SIGN_UP} className="ui-btn ui-btn-primary ui-btn-sm">{t('landing_get_started')}</Link>
            <button
              type="button"
              className="lp-icon-btn lp-menu-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="lp-mobile-menu"
              aria-label={menuOpen ? t('landing_menu_close') : t('landing_menu_open')}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="lp-mobile-menu" className="lp-mobile-menu">
            <nav className="lp-container" aria-label={t('landing_nav_label')}>
              {NAV.map(([id, key]) => <a key={id} href={`#${id}`} onClick={closeMenu}>{t(key)}</a>)}
              <div className="lp-mobile-menu-foot">
                <Link to={SIGN_IN} className="ui-btn ui-btn-secondary ui-btn-md" onClick={closeMenu}>{t('sign_in')}</Link>
                <div className="lp-menu-tools">{tools}</div>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="main">
        {/* ------------------------------ HERO ----------------------------- */}
        <section className="lp-hero" id="product" aria-labelledby="lp-hero-title">
          <div className="lp-container">
            <div className="lp-hero-copy">
              <motion.div variants={heroHeader} initial="initial" animate="animate">
                <span className="lp-tag">{t('landing_hero_eyebrow')}</span>
                <h1 className="lp-h1" id="lp-hero-title">
                  <span>{t('landing_hero_title_1')}</span>
                  <span className="lp-h1-muted">{t('landing_hero_title_2')}</span>
                </h1>
              </motion.div>
              <motion.div variants={heroBody} initial="initial" animate="animate">
                <p className="lp-lede">{t('landing_hero_sub')}</p>
                <div className="lp-cta-row">
                  <Link to={SIGN_UP} className="ui-btn ui-btn-primary ui-btn-lg">
                    {t('landing_get_started')} <IconArrowRight width={16} height={16} />
                  </Link>
                  <Link to={SIGN_IN} className="ui-btn ui-btn-secondary ui-btn-lg">{t('sign_in')}</Link>
                </div>
                <p className="lp-hero-note">{t('landing_hero_note')}</p>
              </motion.div>
            </div>

            <Reveal className="lp-hero-visual">
              <ProductPreview />
            </Reveal>
          </div>
        </section>

        {/* ---------------------------- FEATURES --------------------------- */}
        <section className="lp-section" id="features" aria-labelledby="lp-features-title">
          <div className="lp-container">
            <SectionHead
              id="lp-features-title"
              eyebrow={t('landing_features_eyebrow')}
              title={t('landing_features_title')}
              lede={t('landing_features_lede')}
            />
            <RevealGroup className="lp-grid">
              {FEATURES.map(({ n, icon: Icon }) => (
                <RevealItem className="lp-cell" key={n} as="article">
                  <span className="lp-cell-icon"><Icon width={18} height={18} /></span>
                  <h3>{t(`landing_f${n}_title`)}</h3>
                  <p>{t(`landing_f${n}_desc`)}</p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* --------------------------- HOW IT WORKS ------------------------ */}
        <section className="lp-section" id="how-it-works" aria-labelledby="lp-how-title">
          <div className="lp-container">
            <SectionHead
              id="lp-how-title"
              eyebrow={t('landing_how_eyebrow')}
              title={t('landing_how_title')}
            />
            <RevealGroup className="lp-steps" as="ol">
              {[1, 2, 3].map((n) => (
                <RevealItem className="lp-step" key={n} as="li">
                  <span className="lp-step-num" aria-hidden="true">0{n}</span>
                  <h3>{t(`landing_s${n}_title`)}</h3>
                  <p>{t(`landing_s${n}_desc`)}</p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ------------------------------ WHY ------------------------------ */}
        <section className="lp-section" aria-labelledby="lp-why-title">
          <div className="lp-container lp-split">
            <SectionHead
              id="lp-why-title"
              eyebrow={t('landing_why_eyebrow')}
              title={t('landing_why_title')}
              lede={t('landing_why_lede')}
            />
            <RevealGroup className="lp-why-list" as="ul">
              {[1, 2, 3, 4, 5].map((n) => (
                <RevealItem as="li" key={n}>
                  <span className="lp-why-check" aria-hidden="true"><IconCheck width={16} height={16} /></span>
                  <div>
                    <h3>{t(`landing_w${n}_title`)}</h3>
                    <p>{t(`landing_w${n}_desc`)}</p>
                  </div>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* -------------------------- ASSISTANT (AI) ----------------------- */}
        <section className="lp-section" id="assistant" aria-labelledby="lp-ai-title">
          <div className="lp-container lp-split lp-split-center">
            <div>
              <SectionHead
                id="lp-ai-title"
                eyebrow={t('landing_ai_eyebrow')}
                title={t('landing_ai_title')}
                lede={t('landing_ai_lede')}
              />
              <Reveal>
                <ul className="lp-bullets">
                  {[1, 2, 3].map((n) => <li key={n}>{t(`landing_ai_b${n}`)}</li>)}
                </ul>
              </Reveal>
            </div>

            <Reveal>
              <figure className="lp-chat-wrap">
                <div className="lp-chat">
                  <div className="lp-chat-user">{t('landing_ai_q')}</div>
                  <div className="lp-chat-bot-wrap">
                    <span className="lp-chat-label"><IconSparkle width={12} height={12} /> {t('assistant_label')}</span>
                    <div className="lp-chat-bot">{t('landing_ai_a')}</div>
                  </div>
                  <div className="lp-chat-action">
                    <span className="lp-chat-action-label">{t('landing_ai_action')}</span>
                    <span className="lp-chat-action-btns" aria-hidden="true">
                      <span className="ui-btn ui-btn-primary ui-btn-sm">{t('landing_ai_confirm')}</span>
                      <span className="ui-btn ui-btn-secondary ui-btn-sm">{t('dismiss')}</span>
                    </span>
                  </div>
                </div>
                <figcaption className="lp-pv-caption">{t('landing_ai_caption')}</figcaption>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------- SECURITY -------------------------- */}
        <section className="lp-section" id="security" aria-labelledby="lp-sec-title">
          <div className="lp-container">
            <SectionHead
              id="lp-sec-title"
              eyebrow={t('landing_sec_eyebrow')}
              title={t('landing_sec_title')}
              lede={t('landing_sec_lede')}
            />
            <RevealGroup className="lp-grid">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <RevealItem className="lp-cell" key={n} as="article">
                  <h3>{t(`landing_t${n}_title`)}</h3>
                  <p>{t(`landing_t${n}_desc`)}</p>
                </RevealItem>
              ))}
            </RevealGroup>
          </div>
        </section>

        {/* ----------------------------- FINAL CTA ------------------------- */}
        <section className="lp-final" aria-labelledby="lp-cta-title">
          <div className="lp-container">
            <Reveal className="lp-final-card">
              <h2 id="lp-cta-title">{t('landing_cta_title')}</h2>
              <p>{t('landing_cta_sub')}</p>
              <div className="lp-cta-row">
                <Link to={SIGN_UP} className="ui-btn ui-btn-primary ui-btn-lg">
                  {t('landing_get_started')} <IconArrowRight width={16} height={16} />
                </Link>
                <Link to={SIGN_IN} className="ui-btn ui-btn-secondary ui-btn-lg">{t('sign_in')}</Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ------------------------------ FOOTER ----------------------------- */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand">
              <span className="wordmark small"><IconLekhaMark width={26} height={26} />Lekha</span>
              <p>{t('tagline')}</p>
            </div>
            <nav aria-labelledby="lp-footer-product">
              <p className="lp-footer-title" id="lp-footer-product">{t('landing_nav_product')}</p>
              <a href="#features">{t('landing_nav_features')}</a>
              <a href="#how-it-works">{t('landing_nav_how')}</a>
              <a href="#security">{t('landing_nav_security')}</a>
            </nav>
            <nav aria-labelledby="lp-footer-account">
              <p className="lp-footer-title" id="lp-footer-account">{t('landing_footer_account')}</p>
              <Link to={SIGN_IN}>{t('sign_in')}</Link>
              <Link to={SIGN_UP}>{t('landing_get_started')}</Link>
            </nav>
          </div>
          <p className="lp-footer-bottom">{t('landing_copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  )
}
