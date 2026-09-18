import { duration, easing } from './transitions.js'

/**
 * Tactile button feedback: lift on hover, compress on press.
 *
 * The press state matters more than the hover one — it's the only
 * confirmation a person gets that a click registered before the network
 * responds, and it's the difference between an interface that feels
 * responsive and one that feels laggy even at identical latency.
 *
 * Press is faster than hover on purpose; feedback to a direct action
 * should feel instantaneous.
 */
export const buttonVariants = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -1,
    transition: { duration: duration.fast, ease: easing.out },
  },
  tap: {
    y: 0,
    scale: 0.98,
    transition: { duration: 0.09, ease: easing.out },
  },
}

/**
 * Icon-only controls (theme toggle, collapse, close). No lift — at 32px
 * square a 1px rise is invisible, so the whole signal is the compression.
 */
export const iconButtonVariants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.06,
    transition: { duration: duration.fast, ease: easing.out },
  },
  tap: {
    scale: 0.94,
    transition: { duration: 0.09, ease: easing.out },
  },
}
