import { duration, easing } from './transitions.js'

/**
 * Staggered list reveal.
 *
 * Pair these: `listVariants` on the container, `listItemVariants` on each
 * child. The container drives the stagger, so children never need their
 * own delay maths (the usual source of `delay: i * 0.05` scattered
 * through a codebase).
 *
 * 45ms between items sits inside the brief's 40–60ms window: enough to
 * read as a sequence, short enough that a 12-row table finishes in about
 * half a second rather than crawling.
 */
export const listVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.04,
    },
  },
}

export const listItemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: duration.fast, ease: easing.out },
  },
}

/**
 * For long lists (ledger rows, search results) where a 45ms stagger would
 * take too long to finish. Same shape, tighter spacing, and it stops
 * staggering past the first handful of items.
 */
export const denseListVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.022,
      delayChildren: 0.02,
    },
  },
}

/**
 * Horizontal variant for row-oriented groups — filter pills, tabs, the
 * mobile nav strip — where items arrive from the inline-start edge.
 */
export const rowItemVariants = {
  initial: { opacity: 0, x: -8 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.fast, ease: easing.out },
  },
}
