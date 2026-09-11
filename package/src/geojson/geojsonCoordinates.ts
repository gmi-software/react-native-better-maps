import type { Coordinate } from '../types/coordinate';
import type { GeojsonPosition } from '../types/geojson';

export function positionToCoordinate(position: GeojsonPosition): Coordinate {
  return {
    longitude: position[0]!,
    latitude: position[1]!,
  };
}

export function lineToCoordinates(positions: GeojsonPosition[]): Coordinate[] {
  return positions.map(positionToCoordinate);
}

export function ringToCoordinates(positions: GeojsonPosition[]): Coordinate[] {
  return positions.slice(0, -1).map(positionToCoordinate);
}
