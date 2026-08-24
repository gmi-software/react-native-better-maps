import type { MarkerDescriptor as PublicMarkerDescriptor } from '../types/overlays';
import type { MarkerDescriptor } from '../native/specs/overlays';
import { resolveMarkerImage } from './resolveMarkerImage';
import { normalizeEnteringAnimation } from '../utils/enteringAnimation';

function normalizeDescriptor(descriptor: PublicMarkerDescriptor): MarkerDescriptor {
  return {
    id: descriptor.id,
    coordinate: descriptor.coordinate,
    title: descriptor.title,
    subtitle: descriptor.subtitle,
    draggable: descriptor.draggable,
    clusterable: descriptor.clusterable,
    image:
      descriptor.image != null ? resolveMarkerImage(descriptor.image) : undefined,
    anchor: descriptor.anchor,
    centerOffset: descriptor.centerOffset,
    rotation: descriptor.rotation,
    flat: descriptor.flat,
    opacity: descriptor.opacity,
    enteringAnimation: normalizeEnteringAnimation(descriptor.enteringAnimation),
  };
}

/**
 * Widens the public marker descriptors into the shape the native view expects,
 * mainly by resolving `require()` image sources.
 *
 * Reference identity of the result does not matter here: `MapView` stabilizes
 * the array structurally before it reaches the native prop.
 */
export function normalizeMarkerDescriptors(
  descriptors: PublicMarkerDescriptor[],
): MarkerDescriptor[] {
  return descriptors.map(normalizeDescriptor);
}
