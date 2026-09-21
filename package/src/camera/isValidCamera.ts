import type { Camera } from '../types/camera';
import { isValidCoordinate } from '../utils/validateGeometry';

// An omitted value is filled in from the camera the map already has, so only a
// supplied one has to be a real number.
function isFiniteOrAbsent(value: number | undefined): boolean {
  return value == null || Number.isFinite(value);
}

/**
 * A camera reaches `MKMapCamera` and `CameraPosition` unchanged. MapKit raises
 * an uncatchable `NSException` for a center it cannot place, and Google Maps
 * throws for a non-finite pitch; the remaining non-finite values are taken
 * silently and leave the camera reading back as `NaN`.
 */
export function isValidCamera(value: Camera | undefined): boolean {
  return (
    value != null &&
    isValidCoordinate(value.center) &&
    isFiniteOrAbsent(value.zoom) &&
    isFiniteOrAbsent(value.heading) &&
    isFiniteOrAbsent(value.pitch) &&
    isFiniteOrAbsent(value.altitude)
  );
}
