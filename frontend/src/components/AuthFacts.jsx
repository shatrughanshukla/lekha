import { useState } from 'react'
import { useT } from '../i18n.jsx'
import '../styles/auth-facts.css'

const FACT_COUNT = 6

/**
 * Rotating "Did you know?" panel for the sign-in / sign-up hero: three facts
 * about Lekha and three about money and bookkeeping.
 *
 * Timing lives in CSS, not in a timer: the active dot's progress bar is a CSS
 * animation, and when it finishes (onAnimationEnd) we move to the next fact.
 * That keeps the bar and the fact perfectly in sync, lets hover/focus pause
 * both with a single `animation-play-state`, and means that with reduced
 * motion (animation: none) nothing auto-advances — the dots still work.
 *
 * All facts are stacked in one grid cell so the panel is always as tall as
 * the longest one: no layout jump when the text changes.
 */
export default function AuthFacts() {
  const { t } = useT()
  const [active, setActive] = useState(0)
  const next = () => setActive((n) => (n + 1) % FACT_COUNT)

  return (
    <div className="auth-facts" role="group" aria-label={t('fact_label')}>
      <p className="auth-facts-label">{t('fact_label')}</p>

      <div className="auth-facts-stage">
        {Array.from({ length: FACT_COUNT }, (_, n) => (
          <p
            key={n}
            className={`auth-fact${n === active ? ' active' : ''}`}
            aria-hidden={n === active ? undefined : true}
          >
            {t(`fact_${n + 1}`)}
          </p>
        ))}
      </div>

      <div className="auth-facts-dots">
        {Array.from({ length: FACT_COUNT }, (_, n) => (
          <button
            key={n}
            type="button"
            className={`auth-facts-dot${n === active ? ' active' : ''}`}
            onClick={() => setActive(n)}
            aria-label={t('fact_show', { n: n + 1 })}
            aria-current={n === active ? 'true' : undefined}
          >
            <span className="auth-facts-fill" onAnimationEnd={n === active ? next : undefined} />
          </button>
        ))}
      </div>
    </div>
  )
}
