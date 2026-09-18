/**
 * Keeps only finite throttle intervals ≥ 0. Negative, NaN, and non-finite
 * values become `undefined` so native adapters apply the documented 100 ms
 * default.
 */
export function normalizeCameraMoveThrottleMs(
  value: number | undefined,
): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
}
