import { describe, expect, test } from 'bun:test';
import { normalizeCameraMoveThrottleMs } from '../cameraMoveThrottle';

describe('normalizeCameraMoveThrottleMs', () => {
  test('passes undefined through', () => {
    expect(normalizeCameraMoveThrottleMs(undefined)).toBeUndefined();
  });

  test('keeps finite values at or above zero', () => {
    expect(normalizeCameraMoveThrottleMs(0)).toBe(0);
    expect(normalizeCameraMoveThrottleMs(16)).toBe(16);
    expect(normalizeCameraMoveThrottleMs(100)).toBe(100);
  });

  test('maps negative, NaN, and non-finite values to undefined', () => {
    expect(normalizeCameraMoveThrottleMs(-1)).toBeUndefined();
    expect(normalizeCameraMoveThrottleMs(Number.NaN)).toBeUndefined();
    expect(normalizeCameraMoveThrottleMs(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(normalizeCameraMoveThrottleMs(Number.NEGATIVE_INFINITY)).toBeUndefined();
  });
});
