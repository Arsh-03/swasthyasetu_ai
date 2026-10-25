import { Easing, ReduceMotion, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

/**
 * Motion tokens (docs/05_ui_ux/motion_and_illustration.md).
 * Principle "Calm over clever": short, ease-out, nothing bounces more than once.
 */
export const duration = {
  press: 150,
  transition: 250,
  /** Reserved for later signature moments (consent seal, dose tick). */
  signature: 400,
} as const;

/** cubic-bezier(0.16, 1, 0.3, 1): fast start, long gentle settle (same curve as the Doctor portal). */
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export const timing = {
  press: { duration: duration.press, easing: easeOut, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
  transition: { duration: duration.transition, easing: easeOut, reduceMotion: ReduceMotion.System } satisfies WithTimingConfig,
};

/** Gentle spring for tactile presses: settles quickly, at most a hint of overshoot. */
export const pressSpring = {
  damping: 18,
  stiffness: 320,
  mass: 0.6,
  reduceMotion: ReduceMotion.System,
} satisfies WithSpringConfig;

/** How far a tactile control shrinks while held. */
export const PRESS_SCALE = 0.97;
