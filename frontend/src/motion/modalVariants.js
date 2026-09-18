import { duration, easing } from './transitions.js'

/**
 * Dialog entrance.
 *
 * Starts at 0.98 rather than something smaller: a modal that grows from
 * far away reads as a notification popping up, while a near-1 start reads
 * as the surface settling into focus. It exits faster than it enters —
 * dismissal should feel immediate, arrival should feel considered.
 */
export const modalVariants = {
  initial: { opacity: 0, scale: 0.98, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: duration.fast, ease: easing.out },
  },
}

export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.fast } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}

/**
 * Banners and toasts that push into the layout from the top of the main
 * column. Height is animated here because the element genuinely changes
 * the document flow — collapsing it with transform alone would leave a
 * gap where the banner used to be.
 */
export const bannerVariants = {
  initial: { opacity: 0, height: 0, y: -4 },
  animate: {
    opacity: 1,
    height: 'auto',
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -4,
    transition: { duration: duration.fast, ease: easing.out },
  },
}
