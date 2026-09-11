import type { Coordinate } from '../types/coordinate';

export function clusterCoordinates(
  markerIds: string[],
  markers: readonly { id: string; coordinate: Coordinate }[],
): Coordinate[] {
  const members = new Set(markerIds);
  const coordinates: Coordinate[] = [];
  for (const marker of markers) {
    if (members.has(marker.id)) coordinates.push(marker.coordinate);
  }
  return coordinates;
}
