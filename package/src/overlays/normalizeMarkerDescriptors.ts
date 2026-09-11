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
    markerColor: descriptor.markerColor,
    anchor: descriptor.anchor,
    centerOffset: descriptor.centerOffset,
    rotation: descriptor.rotation,
    flat: descriptor.flat,
    opacity: descriptor.opacity,
    zIndex: descriptor.zIndex,
    enteringAnimation: normalizeEnteringAnimation(descriptor.enteringAnimation),
  };
}

function descriptorsEqual(
  left: MarkerDescriptor,
  right: MarkerDescriptor,
): boolean {
  return (
    left.id === right.id &&
    left.coordinate.latitude === right.coordinate.latitude &&
    left.coordinate.longitude === right.coordinate.longitude &&
    left.title === right.title &&
    left.subtitle === right.subtitle &&
    left.draggable === right.draggable &&
    left.clusterable === right.clusterable &&
    left.image === right.image &&
    left.markerColor === right.markerColor &&
    left.anchor === right.anchor &&
    left.centerOffset === right.centerOffset &&
    left.rotation === right.rotation &&
    left.flat === right.flat &&
    left.opacity === right.opacity &&
    left.zIndex === right.zIndex &&
    left.enteringAnimation === right.enteringAnimation
  );
}

export function normalizeMarkerDescriptors(
  descriptors: PublicMarkerDescriptor[],
): MarkerDescriptor[] {
  let changed = false;
  const next = descriptors.map((descriptor) => {
    const normalized = normalizeDescriptor(descriptor);
    if (descriptorsEqual(normalized, descriptor as MarkerDescriptor)) {
      return descriptor as MarkerDescriptor;
    }

    changed = true;
    return normalized;
  });

  return changed ? next : (descriptors as MarkerDescriptor[]);
}
