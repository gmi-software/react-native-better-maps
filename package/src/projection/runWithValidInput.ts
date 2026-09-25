import type { Coordinate } from '../types/coordinate';
import type { Point } from '../types/point';
import { isValidCoordinate, isValidPoint } from '../utils/validateGeometry';

export const INVALID_COORDINATE_ERROR =
  'Coordinate rejected: latitude and longitude must be finite and within ±90 / ±180';

export const INVALID_POINT_ERROR = 'Point rejected: x and y must be finite';

/**
 * Runs a `pointForCoordinate` call, or rejects it for a coordinate outside the
 * world. The SDKs disagree about one: MapKit answers `NaN`, or a point past
 * the antimeridian, while Android's `LatLng` clamps the latitude and wraps the
 * longitude and answers for somewhere else entirely.
 *
 * Checked before the call is queued, as `runWithValidCamera` does, so it
 * rejects straight away - also before the native map exists - and the same way
 * on every platform and provider. The native adapters reject it as well, for a
 * `hybridRef` call that never passes through here.
 */
export function runWithValidCoordinate<Result>(
  coordinate: Coordinate,
  run: () => Promise<Result>,
): Promise<Result> {
  if (!isValidCoordinate(coordinate)) {
    return Promise.reject(new Error(INVALID_COORDINATE_ERROR));
  }

  return run();
}

/**
 * Runs a `coordinateForPoint` call, or rejects it for a point whose `x` or `y`
 * is not finite: MapKit answers one with a `NaN` coordinate, and Android has no
 * whole pixel to round it to. Checked before the call is queued, for the same
 * reasons as {@linkcode runWithValidCoordinate}.
 */
export function runWithValidPoint<Result>(
  point: Point,
  run: () => Promise<Result>,
): Promise<Result> {
  if (!isValidPoint(point)) {
    return Promise.reject(new Error(INVALID_POINT_ERROR));
  }

  return run();
}
