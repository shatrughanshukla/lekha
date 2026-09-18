import { duration, easing } from './transitions.js'

/**
 * Global page transition.
 *
 * Vertical only, deliberately: horizontal slides imply a spatial
 * relationship between pages ("back"/"forward"), which is wrong for a flat
 * nav where Reports doesn't sit to the left or right of Accounts. A short
 * rise reads as "new content arriving" without asserting direction.
 *
 * The outgoing page lifts only 8px while the incoming one travels 14px —
 * exits are quieter than entrances, so attention lands on what's arriving.
 */
export const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: duration.fast, ease: easing.out },
  },
}

/**
 * Page header (title + subtitle + actions). Runs marginally ahead of the
 * body content so the page announces what it is before its data fills in.
 */
export const pageHeaderVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out, delay: 0.04 },
  },
}

/**
 * Page body. Slightly later again, completing a three-step cascade
 * (page → header → content) that reads as one motion rather than three.
 */
export const pageContentVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out, delay: 0.08 },
  },
}
