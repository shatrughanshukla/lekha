import { motion } from 'framer-motion'
import { useMotionVariants, staticCardVariants } from '../motion/index.js'

/**
 * One empty-state treatment for the whole product, so "no companies", "no
 * insights yet" and "no search results" all look like the same product
 * saying different things — rather than each page inventing its own.
 *
 * `icon` takes a small line-art SVG component (from Shared.jsx), never an
 * emoji — emoji render inconsistently across OSes and read as informal in
 * a financial product.
 */
export default function EmptyState({ icon: Icon, title, hint, action, compact }) {
  const v = useMotionVariants(staticCardVariants)
  return (
    <motion.div
      className={`empty-state-v2${compact ? ' empty-state-compact' : ''}`}
      variants={v}
      initial="initial"
      animate="animate"
    >
      {Icon && (
        <div className="empty-state-icon">
          <Icon />
        </div>
      )}
      <p className="empty-state-title">{title}</p>
      {hint && <p className="empty-state-hint">{hint}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </motion.div>
  )
}
