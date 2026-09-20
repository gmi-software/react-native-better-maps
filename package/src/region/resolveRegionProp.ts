import type { Region } from '../types/region';
import { isValidRegion } from './isValidRegion';
import { warnRegion } from './warnRegion';

// The native prop must never go from a region back to `undefined`: React
// rewrites a removed prop to `null` (ReactNativeAttributePayload), the optional
// JSI converter only short-circuits on `undefined`, and the generated struct
// converter then calls `asObject` on a null and throws - before any native
// guard runs. Holding the last accepted region leaves the prop untouched
// instead, which is also what the map should show.
export function resolveRegionProp(
  region: Region | undefined,
  lastAccepted: Region | undefined,
): Region | undefined {
  if (region == null || isValidRegion(region)) {
    return region;
  }

  warnRegion('region ignored: invalid center coordinate or deltas');

  return lastAccepted;
}
