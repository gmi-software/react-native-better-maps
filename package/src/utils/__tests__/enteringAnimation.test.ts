import { describe, expect, test } from 'bun:test';
import { normalizeEnteringAnimation } from '../enteringAnimation';

/**
 * Reference identity is deliberately not asserted here: `MapView` stabilizes the
 * descriptor structurally before it reaches the native prop, so this function
 * only has to get the mapping right.
 */
describe('normalizeEnteringAnimation', () => {
  test('passes undefined through', () => {
    expect(normalizeEnteringAnimation(undefined)).toBeUndefined();
  });

  test('maps false onto the "none" kind', () => {
    expect(normalizeEnteringAnimation(false)).toEqual({ kind: 'none' });
  });

  test('maps "system" onto the "system" kind', () => {
    expect(normalizeEnteringAnimation('system')).toEqual({ kind: 'system' });
  });

  test('maps each preset onto its descriptor kind', () => {
    expect(normalizeEnteringAnimation({ preset: 'fade' })).toMatchObject({
      kind: 'fade',
    });
    expect(normalizeEnteringAnimation({ preset: 'fade-scale' })).toMatchObject({
      kind: 'fade-scale',
    });
  });

  test('carries the timing fields across', () => {
    expect(
      normalizeEnteringAnimation({
        preset: 'fade',
        duration: 200,
        delay: 25,
        reduceMotion: 'never',
      }),
    ).toEqual({
      kind: 'fade',
      duration: 200,
      delay: 25,
      reduceMotion: 'never',
    });
  });
});
