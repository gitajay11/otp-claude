/** Shared Framer Motion presets. */

/** Horizontal "error" shake for forms and inputs. */
export const SHAKE = { x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.45 } };

/** Slide between the form step and the OTP step (custom = direction: 1 forward, -1 back). */
export const stepVariants = {
  initial: (dir) => ({ opacity: 0, x: dir * 28 }),
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir) => ({ opacity: 0, x: dir * -28, transition: { duration: 0.18 } }),
};

/**
 * 3D card flip between routes. With reduced motion enabled,
 * <MotionConfig reducedMotion="user"> strips the transforms, leaving a fade.
 */
export const flipVariants = {
  initial: { rotateY: -75, opacity: 0, scale: 0.94 },
  animate: { rotateY: 0, opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
  exit: { rotateY: 75, opacity: 0, scale: 0.94, transition: { duration: 0.32, ease: [0.55, 0, 1, 0.45] } },
};
