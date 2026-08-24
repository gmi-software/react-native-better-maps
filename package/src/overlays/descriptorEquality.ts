import type { Coordinate } from '../types/coordinate';
import type {
  CircleDescriptor,
  MarkerAnchor,
  MarkerDescriptor,
  MarkerImage,
  MarkerPoint,
  OverlayEnteringAnimationDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';

/**
 * Structural comparisons for the descriptors handed to the native map view.
 *
 * Nitro diffs view props by reference identity, so a render that rebuilds an
 * equivalent array would re-serialize every descriptor across JSI. These
 * comparators let the collector hand back the previous array instead.
 *
 * Every field of a descriptor must be compared here - a field left out is a map
 * update that silently never reaches the native side.
 */

function coordinatesEqual(left: Coordinate, right: Coordinate): boolean {
  return (
    left === right ||
    (left.latitude === right.latitude && left.longitude === right.longitude)
  );
}

function coordinateListsEqual(
  left: Coordinate[],
  right: Coordinate[],
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (!coordinatesEqual(left[index], right[index])) {
      return false;
    }
  }

  return true;
}

function pointsEqual(
  left: MarkerAnchor | MarkerPoint | undefined,
  right: MarkerAnchor | MarkerPoint | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return left.x === right.x && left.y === right.y;
}

function markerImagesEqual(
  left: MarkerImage | undefined,
  right: MarkerImage | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return (
    left.uri === right.uri &&
    left.width === right.width &&
    left.height === right.height &&
    left.scale === right.scale
  );
}

export function enteringAnimationsEqual(
  left: OverlayEnteringAnimationDescriptor | undefined,
  right: OverlayEnteringAnimationDescriptor | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return (
    left.kind === right.kind &&
    left.duration === right.duration &&
    left.delay === right.delay &&
    left.reduceMotion === right.reduceMotion
  );
}

export function markerDescriptorsEqual(
  left: MarkerDescriptor,
  right: MarkerDescriptor,
): boolean {
  return (
    left === right ||
    (left.id === right.id &&
      coordinatesEqual(left.coordinate, right.coordinate) &&
      left.title === right.title &&
      left.subtitle === right.subtitle &&
      left.draggable === right.draggable &&
      left.clusterable === right.clusterable &&
      markerImagesEqual(left.image, right.image) &&
      pointsEqual(left.anchor, right.anchor) &&
      pointsEqual(left.centerOffset, right.centerOffset) &&
      left.rotation === right.rotation &&
      left.flat === right.flat &&
      left.opacity === right.opacity &&
      enteringAnimationsEqual(left.enteringAnimation, right.enteringAnimation))
  );
}

export function polylineDescriptorsEqual(
  left: PolylineDescriptor,
  right: PolylineDescriptor,
): boolean {
  return (
    left === right ||
    (left.id === right.id &&
      left.strokeColor === right.strokeColor &&
      left.strokeWidth === right.strokeWidth &&
      left.tappable === right.tappable &&
      coordinateListsEqual(left.coordinates, right.coordinates))
  );
}

export function polygonDescriptorsEqual(
  left: PolygonDescriptor,
  right: PolygonDescriptor,
): boolean {
  return (
    left === right ||
    (left.id === right.id &&
      left.fillColor === right.fillColor &&
      left.strokeColor === right.strokeColor &&
      left.strokeWidth === right.strokeWidth &&
      left.tappable === right.tappable &&
      coordinateListsEqual(left.coordinates, right.coordinates))
  );
}

export function circleDescriptorsEqual(
  left: CircleDescriptor,
  right: CircleDescriptor,
): boolean {
  return (
    left === right ||
    (left.id === right.id &&
      left.radius === right.radius &&
      left.fillColor === right.fillColor &&
      left.strokeColor === right.strokeColor &&
      left.strokeWidth === right.strokeWidth &&
      left.tappable === right.tappable &&
      coordinatesEqual(left.center, right.center))
  );
}

export function descriptorListsEqual<Descriptor>(
  left: Descriptor[],
  right: Descriptor[],
  descriptorsEqual: (left: Descriptor, right: Descriptor) => boolean,
): boolean {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (!descriptorsEqual(left[index], right[index])) {
      return false;
    }
  }

  return true;
}

export function markerListsEqual(
  left: MarkerDescriptor[],
  right: MarkerDescriptor[],
): boolean {
  return descriptorListsEqual(left, right, markerDescriptorsEqual);
}

export function polylineListsEqual(
  left: PolylineDescriptor[],
  right: PolylineDescriptor[],
): boolean {
  return descriptorListsEqual(left, right, polylineDescriptorsEqual);
}

export function polygonListsEqual(
  left: PolygonDescriptor[],
  right: PolygonDescriptor[],
): boolean {
  return descriptorListsEqual(left, right, polygonDescriptorsEqual);
}

export function circleListsEqual(
  left: CircleDescriptor[],
  right: CircleDescriptor[],
): boolean {
  return descriptorListsEqual(left, right, circleDescriptorsEqual);
}
