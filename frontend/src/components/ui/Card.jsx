import { motion } from 'framer-motion'

// A single Card primitive so every surface (KPI tiles, panels, list items)
// shares the same border/radius/shadow language instead of each page
// defining its own bordered-box variant. `interactive` adds hover/press
// affordances for clickable cards (e.g. a company tile).
export default function Card({ children, interactive = false, padding = 'md', className = '', ...rest }) {
  const Tag = interactive ? motion.button : motion.div
  return (
    <Tag
      className={`ui-card ui-card-pad-${padding} ${interactive ? 'ui-card-interactive' : ''} ${className}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { y: 0 } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
