import { motion } from 'framer-motion'
import { useMotionVariants } from '../motion/index.js'

// Skeletons animate opacity only (brief, point 9) — no shimmer sweep, no
// transform. A pulsing block is the calm, "we know what's coming" signal;
// a moving shimmer reads as a loading *effect*, which is the opposite of
// what a financial product should look like while it's thinking.
const pulseVariants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 0.85, 0.5],
    transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
  },
}

export function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  const v = useMotionVariants(pulseVariants)
  return (
    <motion.span
      className={`skeleton-line ${className}`}
      style={{ width, height }}
      variants={v}
      initial="initial"
      animate="animate"
    />
  )
}

export function SkeletonCircle({ size = 36 }) {
  const v = useMotionVariants(pulseVariants)
  return (
    <motion.span
      className="skeleton-circle"
      style={{ width: size, height: size }}
      variants={v}
      initial="initial"
      animate="animate"
    />
  )
}

/** A company/summary card shell — mirrors the real card's internal rhythm
 * so the layout doesn't jump when real content replaces it. */
export function SkeletonCard() {
  return (
    <div className="ui-card ui-card-pad-md skeleton-card">
      <div className="skeleton-card-top">
        <SkeletonCircle size={32} />
        <SkeletonLine width={20} height={20} />
      </div>
      <SkeletonLine width="70%" height={17} className="skeleton-mb" />
      <SkeletonLine width="45%" height={12} />
      <div className="skeleton-card-stats">
        <SkeletonLine width="30%" height={11} />
        <SkeletonLine width="30%" height={11} />
      </div>
    </div>
  )
}

/** N skeleton table rows matching the ledger's column rhythm. */
export function SkeletonTableRows({ rows = 5, columns = 4 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="skeleton-row">
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c}><SkeletonLine width={c === 0 ? '80%' : '55%'} /></td>
          ))}
        </tr>
      ))}
    </>
  )
}

/** Inline text-streaming skeleton for the insights panel while the model
 * is "thinking" — a few lines of decreasing width, like paragraph text. */
export function SkeletonParagraph({ lines = 3 }) {
  const widths = ['96%', '88%', '62%']
  return (
    <div className="skeleton-paragraph">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} height={13} />
      ))}
    </div>
  )
}
