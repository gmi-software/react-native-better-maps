import type {
  CircleDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';

/**
 * Copies the bulk shape descriptors with `null` optional fields made
 * `undefined`, for the reason given on `buildMarkerDescriptor`.
 *
 * Reference identity of the result does not matter here: `MapView` stabilizes
 * the array structurally before it reaches the native prop.
 */

function normalizePolylineDescriptor(
  descriptor: PolylineDescriptor,
): PolylineDescriptor {
  return {
    id: descriptor.id,
    coordinates: descriptor.coordinates,
    strokeColor: descriptor.strokeColor ?? undefined,
    strokeWidth: descriptor.strokeWidth ?? undefined,
    zIndex: descriptor.zIndex ?? undefined,
    tappable: descriptor.tappable ?? undefined,
  };
}

function normalizePolygonDescriptor(
  descriptor: PolygonDescriptor,
): PolygonDescriptor {
  return {
    id: descriptor.id,
    coordinates: descriptor.coordinates,
    holes: descriptor.holes ?? undefined,
    fillColor: descriptor.fillColor ?? undefined,
    strokeColor: descriptor.strokeColor ?? undefined,
    strokeWidth: descriptor.strokeWidth ?? undefined,
    zIndex: descriptor.zIndex ?? undefined,
    tappable: descriptor.tappable ?? undefined,
  };
}

function normalizeCircleDescriptor(
  descriptor: CircleDescriptor,
): CircleDescriptor {
  return {
    id: descriptor.id,
    center: descriptor.center,
    radius: descriptor.radius,
    fillColor: descriptor.fillColor ?? undefined,
    strokeColor: descriptor.strokeColor ?? undefined,
    strokeWidth: descriptor.strokeWidth ?? undefined,
    tappable: descriptor.tappable ?? undefined,
  };
}

export function normalizePolylineDescriptors(
  descriptors: PolylineDescriptor[],
): PolylineDescriptor[] {
  return descriptors.map(normalizePolylineDescriptor);
}

export function normalizePolygonDescriptors(
  descriptors: PolygonDescriptor[],
): PolygonDescriptor[] {
  return descriptors.map(normalizePolygonDescriptor);
}

export function normalizeCircleDescriptors(
  descriptors: CircleDescriptor[],
): CircleDescriptor[] {
  return descriptors.map(normalizeCircleDescriptor);
}
