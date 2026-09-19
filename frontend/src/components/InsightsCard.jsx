import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconSparkle } from './Shared.jsx'
import { SkeletonParagraph } from './Skeleton.jsx'
import EmptyState from './EmptyState.jsx'
import { useMotionVariants, listVariants, listItemVariants, buttonVariants } from '../motion/index.js'
import { useT } from '../i18n.jsx'

/**
 * Splits into sentences and animates them in with a short stagger — the
 * closest honest approximation of "streaming" available without the
 * backend actually streaming tokens (it returns one JSON response, not an
 * SSE/chunked stream). This runs once, on the response that just arrived;
 * it never re-runs on a cached response the user has already seen this
 * session, which would feel like the AI is "re-thinking" something it
 * already told them.
 */
function useSentenceReveal(text, revealedFor) {
  const sentences = useMemo(
    () => (text ? text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [text] : []),
    [text]
  )
  return { sentences, animate: !!text && text !== revealedFor }
}

function relativeTime(ts, t) {
  if (!ts) return null
  const diffMs = Date.now() - ts
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t('cached_just_now')
  if (mins < 60) return t('cached_minutes_ago', { n: mins })
  return t('cached_hours_ago', { n: Math.floor(mins / 60) })
}

/**
 * Props:
 *   insights        current { insight, cached } response, or null
 *   loading         true while a request is in flight
 *   onGenerate      called for both first generation and refresh
 *   emptyHint       shown before anything has been generated
 *   fetchedAt       ms timestamp of when `insights` was fetched (client-side —
 *                   the API doesn't return a generation time, see Phase 3 notes)
 *   findings        optional [{ icon, label, sublabel }] — real, computed
 *                    client-side from already-fetched data (NOT part of the
 *                    LLM response). The LLM only ever returns free text; a
 *                    structured "findings" list would mean asking it to
 *                    emit JSON we then trust blindly, which is worse than
 *                    computing the same facts ourselves from numbers we
 *                    already have and know are correct.
 *   compact         tighter empty/loading state — used on the dashboard,
 *                    where this card sits beside the balance panel rather
 *                    than spanning the full width
 */
export default function InsightsCard({ title, insights, loading, onGenerate, emptyHint, fetchedAt, findings, compact }) {
  const { t } = useT()
  const [revealedFor, setRevealedFor] = useState(null)
  const listVars = useMotionVariants(listVariants)
  const itemVars = useMotionVariants(listItemVariants)
  const btn = useMotionVariants(buttonVariants)
  const { sentences, animate } = useSentenceReveal(insights?.insight, revealedFor)
  const [, forceTick] = useState(0)

  // Once a given insight has played its reveal, remember its exact text so
  // switching tabs away and back — or a re-render — doesn't replay the
  // animation. A genuinely new insight (different text, e.g. after
  // Refresh) has a different value here and animates again.
  useEffect(() => {
    if (insights?.insight && insights.insight !== revealedFor) {
      const id = insights.insight
      const timer = setTimeout(() => setRevealedFor(id), 900)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insights?.insight])

  // Re-render once a minute so the relative timestamp ("3m ago") stays
  // live without a scheduled clock — this component is the only place
  // that needs it, so a stray interval per instance is cheap and simple.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const timeLabel = relativeTime(fetchedAt, t)

  return (
    <section className={`panel insights-card-v2${compact ? ' insights-compact' : ''}`}>
      <div className="panel-head insights-head">
        <h2><IconSparkle /> {title}</h2>
        <div className="insights-head-right">
          {insights && !loading && (
            <span className="insights-meta-inline">
              {insights.cached && <span className="badge-neutral">{t('cached_label')}</span>}
              {insights.cached && timeLabel && ' · '}
              {timeLabel && <span className="insights-timestamp">{t('cached_generated', { time: timeLabel })}</span>}
            </span>
          )}
          <motion.button
            className="btn-ghost small"
            onClick={onGenerate}
            disabled={loading}
            variants={btn}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            {loading ? t('thinking') : insights ? t('refresh') : t('generate')}
          </motion.button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SkeletonParagraph lines={compact ? 2 : 3} />
            <p className="insights-thinking-label">{t('thinking_long')}</p>
          </motion.div>
        ) : insights ? (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.p
              className="insight-text"
              variants={animate ? listVars : undefined}
              initial={animate ? 'initial' : false}
              animate={animate ? 'animate' : false}
            >
              {sentences.map((sentence, i) => (
                <motion.span key={i} variants={animate ? itemVars : undefined} style={{ display: 'inline' }}>
                  {sentence}{' '}
                </motion.span>
              ))}
            </motion.p>

            {findings && findings.length > 0 && (
              <div className="insights-findings">
                {findings.map((f, i) => (
                  <div className="insights-finding" key={i}>
                    <span className="insights-finding-icon">{f.icon}</span>
                    <div className="insights-finding-text">
                      <span className="insights-finding-label">{f.label}</span>
                      <span className="insights-finding-sublabel">{f.sublabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState icon={IconSparkle} title={t('no_insights_title')} hint={emptyHint} compact={compact} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
