/**
 * Motion primitives — the JS half of the Phase 1 motion tokens.
 *
 * These values intentionally mirror the CSS custom properties in index.css
 * (--duration-*, --ease-*). CSS transitions and Framer Motion animations
 * therefore run on the same curves, so a hover handled in CSS and a layout
 * move handled by Framer never look like they belong to different apps.
 *
 * Nothing in this file animates anything by itself — it's the vocabulary
 * every variant file below composes from. If a duration or curve needs to
 * change, it changes here once rather than in dozens of inline objects.
 */

/** Seconds, because Framer Motion works in seconds while CSS works in ms. */
export const duration = {
  fast: 0.18,   // --duration-fast   180ms
  base: 0.24,   // --duration-base   240ms
  slow: 0.32,   // --duration-slow   320ms
  slower: 0.35, // --duration-slower 350ms
}

export const easing = {
  /** Decelerating — entrances, reveals, anything arriving. */
  out: [0.22, 1, 0.36, 1],
  /** Symmetric — elements moving from one place to another. */
  inOut: [0.65, 0, 0.35, 1],
  /** Gentle overshoot. Used sparingly; never on anything text-heavy. */
  spring: [0.34, 1.4, 0.64, 1],
}

/** Ready-made transition objects, so variants don't re-declare them. */
export const transition = {
  fast: { duration: duration.fast, ease: easing.out },
  base: { duration: duration.base, ease: easing.out },
  slow: { duration: duration.slow, ease: easing.out },
  move: { duration: duration.base, ease: easing.inOut },
}

/**
 * Layout transitions use a real spring rather than a fixed duration: a
 * spring settles based on distance travelled, so a sidebar collapsing
 * 168px and an active pill sliding 40px both feel correct instead of one
 * looking sluggish. Tuned to be critically damped — no visible bounce.
 */
export const layoutSpring = {
  type: 'spring',
  stiffness: 420,
  damping: 40,
  mass: 0.8,
}

/**
 * Collapses any variant set to a pure cross-fade when the user has asked
 * for reduced motion. Movement and scale are dropped; opacity is kept so
 * state changes remain perceivable (going fully static can make an app
 * feel broken rather than calm).
 *
 * Every component in the app routes its variants through this rather than
 * branching on `prefers-reduced-motion` at each call site.
 */
export function reduce(variants, shouldReduce) {
  if (!shouldReduce) return variants

  const stripped = {}
  for (const [state, value] of Object.entries(variants)) {
    if (typeof value !== 'object' || value === null) {
      stripped[state] = value
      continue
    }
    const { x, y, scale, rotate, transition: _t, ...rest } = value
    stripped[state] = { ...rest, transition: { duration: 0.01 } }
  }
  return stripped
}
