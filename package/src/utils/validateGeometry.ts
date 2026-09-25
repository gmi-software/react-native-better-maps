import type { Coordinate } from '../types/coordinate';
import type { Point } from '../types/point';

export function isValidCoordinate(value: Coordinate | undefined): boolean {
  return (
    value != null &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

export function isValidCoordinateList(
  value: Coordinate[] | undefined,
  minimumLength: number,
): boolean {
  if (!Array.isArray(value) || value.length < minimumLength) {
    return false;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!isValidCoordinate(value[index])) {
      return false;
    }
  }

  return true;
}

export function isValidRadius(value: number | undefined): boolean {
  return value != null && Number.isFinite(value) && value >= 0;
}

// Any finite point converts, including one outside the map view - it stands for
// somewhere just off screen.
export function isValidPoint(value: Point | undefined): boolean {
  return value != null && Number.isFinite(value.x) && Number.isFinite(value.y);
}
