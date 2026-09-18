/**
 * Single entry point for the motion system.
 *
 * Components import from 'src/motion' and never define inline animation
 * objects — that's what keeps timing consistent across the product and
 * makes a global timing change a one-file edit.
 */
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { reduce } from './transitions.js'

export * from './transitions.js'
export * from './pageVariants.js'
export * from './listVariants.js'
export * from './cardVariants.js'
export * from './sidebarVariants.js'
export * from './modalVariants.js'
export * from './buttonVariants.js'

/**
 * Returns the given variants, stripped down to a cross-fade if the user
 * has `prefers-reduced-motion: reduce` set.
 *
 * Accessibility here is handled in JS as well as CSS on purpose: the
 * global CSS rule in index.css neutralises *CSS* transitions, but Framer
 * Motion animates inline styles via rAF and ignores that rule entirely.
 * Without this hook, reduced-motion users would still see every page
 * slide and every drawer fly in.
 */
export function useMotionVariants(variants) {
  const shouldReduce = useReducedMotion()
  return reduce(variants, shouldReduce)
}

/**
 * Small matchMedia hook, used to decide between the desktop rail and the
 * mobile drawer. This is a genuine behavioural fork (different markup,
 * different animation, different dismissal), not something a media query
 * alone can express.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** The one breakpoint where the rail becomes a drawer. */
export const MOBILE_QUERY = '(max-width: 900px)'
