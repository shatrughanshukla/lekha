import { duration, easing } from './transitions.js'

/**
 * Card interaction.
 *
 * The brief caps scale at 1.01 — that's near-imperceptible as *size* and
 * instead reads as the card lifting toward you, which is the intent.
 * Anything larger starts to feel like a toy.
 *
 * Elevation (the shadow) is left to CSS via the --shadow-* tokens rather
 * than animated here: box-shadow is expensive to animate and CSS handles
 * the same hover state on the same curve for free.
 */
export const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
  hover: {
    y: -2,
    scale: 1.006,
    transition: { duration: duration.fast, ease: easing.out },
  },
  tap: {
    y: 0,
    scale: 0.996,
    transition: { duration: 0.1, ease: easing.out },
  },
}

/**
 * Non-interactive cards (KPI tiles, summary panels) — they should still
 * arrive with the page, but they don't respond to a pointer because
 * nothing happens when you click them.
 */
export const staticCardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: easing.out },
  },
}
