import type { OverlayEnteringAnimation } from '../types/overlays';
import type { OverlayEnteringAnimationDescriptor } from '../native/specs/overlays';

export function normalizeEnteringAnimation(
  animation: OverlayEnteringAnimation | undefined,
): OverlayEnteringAnimationDescriptor | undefined {
  if (animation == null) {
    return undefined;
  }

  if (animation === false) {
    return { kind: 'none' };
  }

  if (animation === 'system') {
    return { kind: 'system' };
  }

  return {
    kind: animation.preset,
    duration: animation.duration,
    delay: animation.delay,
    reduceMotion: animation.reduceMotion,
  };
}
