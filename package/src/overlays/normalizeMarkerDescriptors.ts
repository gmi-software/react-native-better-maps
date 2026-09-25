import type { MarkerDescriptor as PublicMarkerDescriptor } from '../types/overlays';
import type { MarkerDescriptor } from '../native/specs/overlays';
import { buildMarkerDescriptor } from './collectMarkerOverlay';
import { resolveMarkerImage } from './resolveMarkerImage';
import { warnOverlay } from './warnOverlay';
import { isValidCoordinate } from '../utils/validateGeometry';

/**
 * Widens the public marker descriptors into the shape the native view expects:
 * `require()` image sources are resolved and `null` optional fields dropped.
 * Descriptors whose coordinate cannot be placed are skipped with the development
 * warning a `<Marker>` child gets. Native filters them too, for `hybridRef`, but
 * only JS can warn.
 *
 * Reference identity of the result does not matter here: `MapView` stabilizes
 * the array structurally before it reaches the native prop.
 */
export function normalizeMarkerDescriptors(
  descriptors: PublicMarkerDescriptor[],
): MarkerDescriptor[] {
  const normalized: MarkerDescriptor[] = [];
  for (const descriptor of descriptors) {
    if (!isValidCoordinate(descriptor.coordinate)) {
      warnOverlay(`marker "${descriptor.id}" skipped: invalid coordinate`);
      continue;
    }

    normalized.push(
      buildMarkerDescriptor(descriptor.id, descriptor, resolveMarkerImage),
    );
  }

  return normalized;
}
