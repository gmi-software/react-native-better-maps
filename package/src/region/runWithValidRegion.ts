import type { Region } from '../types/region';
import { isValidRegion } from './isValidRegion';

export const INVALID_REGION_ERROR =
  'Region rejected: invalid center coordinate, or a latitudeDelta or longitudeDelta that is not a finite number greater than 0';

/**
 * Runs an `animateToRegion` call, or rejects it when the map cannot use the
 * region - the region counterpart of `runWithValidCamera`, for the same
 * reasons.
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
