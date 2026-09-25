import type { MarkerDescriptor as PublicMarkerDescriptor } from '../types/overlays';
import type { MarkerDescriptor } from '../native/specs/overlays';
import { buildMarkerDescriptor } from './collectMarkerOverlay';
import { resolveMarkerImage } from './resolveMarkerImage';

/**
 * Widens the public marker descriptors into the shape the native view expects:
 * `require()` image sources are resolved and `null` optional fields dropped.
 *
 * Reference identity of the result does not matter here: `MapView` stabilizes
 * the array structurally before it reaches the native prop.
 */
export function normalizeMarkerDescriptors(
  descriptors: PublicMarkerDescriptor[],
): MarkerDescriptor[] {
  return descriptors.map((descriptor) =>
    buildMarkerDescriptor(descriptor.id, descriptor, resolveMarkerImage),
  );
}
