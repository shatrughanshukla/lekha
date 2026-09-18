import { duration, easing, layoutSpring } from './transitions.js'

/** Rail widths, shared by the variants below and by the CSS drawer rules. */
export const SIDEBAR_WIDTH = 244
export const SIDEBAR_COLLAPSED_WIDTH = 76

/**
 * Desktop rail collapse.
 *
 * This is the one place the app deliberately animates `width`. The brief
 * asks to avoid it, and normally that's right — but the alternative
 * (transform: scaleX) squashes every icon and label inside the rail, and
 * a layout animation on the rail would force its entire subtree to be
 * layout-projected on every frame. One width animation on one element,
 * driven by a spring, is cheaper and looks correct. Everything *else* in
 * this phase animates on opacity and transform only.
 */
export const railVariants = {
  expanded: { width: SIDEBAR_WIDTH, transition: layoutSpring },
  collapsed: { width: SIDEBAR_COLLAPSED_WIDTH, transition: layoutSpring },
}

/**
 * Nav labels fade and slide a few pixels rather than being unmounted
 * instantly — without this the text vanishes a frame before the rail
 * starts moving, which is the single biggest tell of a "cheap" collapse.
 *
 * Exit is faster than enter so labels are gone before the rail narrows
 * enough to clip them.
 */
export const sidebarLabelVariants = {
  initial: { opacity: 0, x: -6 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.fast, ease: easing.out, delay: 0.06 },
  },
  exit: {
    opacity: 0,
    x: -6,
    transition: { duration: 0.12, ease: easing.out },
  },
}

/** Mobile drawer — slides in from the inline-start edge. */
export const drawerVariants = {
  closed: {
    x: '-100%',
    transition: { duration: duration.base, ease: easing.inOut },
  },
  open: {
    x: 0,
    transition: { duration: duration.slow, ease: easing.out },
  },
}

/** Backdrop behind the mobile drawer. Fade only — it has no geometry. */
export const backdropVariants = {
  closed: { opacity: 0, transition: { duration: duration.fast } },
  open: { opacity: 1, transition: { duration: duration.base } },
}
