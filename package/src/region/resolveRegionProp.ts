import type { Region } from '../types/region';
import { isValidRegion } from './isValidRegion';
import { warnRegion } from './warnRegion';

// Once the view has accepted a region the prop must never go back to
// `undefined`, whether it was unset or is unusable: React rewrites a removed
// prop to `null` (ReactNativeAttributePayload), the optional JSI converter only
// short-circuits on `undefined`, and the generated struct converter then calls
// `asObject` on a null and throws - before any native guard runs. Holding the
// last accepted region leaves the prop untouched instead, which is also what
// the map should show. Before anything has been accepted there is nothing to
// hold, and `undefined` at mount is safe: React omits the key entirely.
export function resolveRegionProp(
  region: Region | undefined,
  lastAccepted: Region | undefined,
): Region | undefined {
  if (region == null) {
    return lastAccepted;
  }

  if (isValidRegion(region)) {
    return region;
  }

  warnRegion('region ignored: invalid center coordinate or deltas');

  return lastAccepted;
}
