import type { Coordinate } from '../types/coordinate';
import { isValidCoordinate } from '../utils/validateGeometry';
import { warnRegion } from './warnRegion';

// The native adapters drop unplaceable coordinates too - they have to, since
// `hybridRef` reaches them directly - but only Android can report it, and to
// logcat. Filtering here is what gives both platforms the same warning.
export function resolveFitCoordinates(coordinates: Coordinate[]): Coordinate[] {
  const placeable = coordinates.filter((coordinate) =>
    isValidCoordinate(coordinate),
  );

  if (placeable.length !== coordinates.length) {
    warnRegion(
      `fitToCoordinates ignored ${coordinates.length - placeable.length} coordinate(s) outside the world`,
    );
  }

  return placeable;
}
