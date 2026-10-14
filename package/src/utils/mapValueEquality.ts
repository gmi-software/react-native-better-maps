import type { Camera } from '../types/camera';
import type { EdgePadding, Region } from '../types/region';

/**
 * Structural comparisons for the camera-related `MapView` props.
 *
 * Nitro diffs view props by reference identity, and `region`, `camera` and
 * `mapPadding` are usually written inline in JSX. Without these comparators an
 * equal-but-new object reaches native on every render, and the Google
 * providers answer a new `region` with a camera move.
 */

export function regionsEqual(
  left: Region | undefined,
  right: Region | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return (
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.latitudeDelta === right.latitudeDelta &&
    left.longitudeDelta === right.longitudeDelta
  );
}

export function camerasEqual(
  left: Camera | undefined,
  right: Camera | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return (
    left.center.latitude === right.center.latitude &&
    left.center.longitude === right.center.longitude &&
    left.zoom === right.zoom &&
    left.heading === right.heading &&
    left.pitch === right.pitch &&
    left.altitude === right.altitude
  );
}

export function edgePaddingsEqual(
  left: EdgePadding | undefined,
  right: EdgePadding | undefined,
): boolean {
  if (left === right) {
    return true;
  }

  if (left == null || right == null) {
    return false;
  }

  return (
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom &&
    left.left === right.left
  );
}
