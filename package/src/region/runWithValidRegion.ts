import type { Region } from '../types/region';
import { isValidRegion } from './isValidRegion';

export const INVALID_REGION_ERROR =
  'Region rejected: invalid center coordinate, or a latitudeDelta or longitudeDelta that is not a finite number greater than 0';

/**
 * Runs an `animateToRegion` call, or rejects it when the map cannot use the
 * region - the counterpart of `runWithValidCamera`. The `region` prop can only
 * skip such a region, but this call has a promise to report it on, and
 * resolving one for a region that never moved the map is the silent no-op
 * `MapViewRef` rules out.
 *
 * Checked before the call is queued, so it rejects straight away - also before
 * the native map exists - and the same way on every platform and provider. The
 * native guards behind it only skip.
 */
export function runWithValidRegion<Result>(
  region: Region,
  run: () => Promise<Result>,
): Promise<Result> {
  if (!isValidRegion(region)) {
    return Promise.reject(new Error(INVALID_REGION_ERROR));
  }

  return run();
}
