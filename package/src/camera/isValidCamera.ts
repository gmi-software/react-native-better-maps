import type { Camera } from '../types/camera';
import { isValidCoordinate } from '../utils/validateGeometry';

// An omitted value is filled in from the camera the map already has, so only a
// supplied one has to be a real number.
function isFiniteOrAbsent(value: number | undefined): boolean {
  return value == null || Number.isFinite(value);
}

// Both SDKs keep zoom as a 32-bit float, and `CameraPosition` keeps bearing as
// one too, so the value they receive is the narrowed one, and anything past
// this range arrives as `Infinity`. The native guards check the narrowed value
// itself; this one is what turns it into a warning, and rejects the last ulp
// either way rather than depending on how the runtime rounds it.
const LARGEST_FLOAT_32 = 3.4028234663852886e38;

function isDrawableAsFloatOrAbsent(value: number | undefined): boolean {
  return (
    value == null ||
    (Number.isFinite(value) && Math.abs(value) <= LARGEST_FLOAT_32)
  );
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
    isDrawableAsFloatOrAbsent(value.zoom) &&
    isDrawableAsFloatOrAbsent(value.heading) &&
    isFiniteOrAbsent(value.pitch) &&
    isFiniteOrAbsent(value.altitude)
  );
}
