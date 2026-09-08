import type {
  MapViewProps,
  MarkerDescriptor,
  MarkerPositionUpdate,
  Region,
} from 'react-native-better-maps';
import { generatePolandMarkers } from '../examples/advancedFeatures';

export type PolylineDescriptor = NonNullable<MapViewProps['polylines']>[number];
export type PolygonDescriptor = NonNullable<MapViewProps['polygons']>[number];

/** Warsaw at city scale: the 10k dataset has its densest hotspot here. */
export const WARSAW_REGION: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/** Whole country: clusters form and re-form as the zoom sweep crosses octaves. */
export const POLAND_REGION: Region = {
  latitude: 51.92,
  longitude: 19.13,
  latitudeDelta: 6.2,
  longitudeDelta: 10.5,
};

const markerCache = new Map<number, MarkerDescriptor[]>();

/** Deterministic Poland dataset, memoized so scenarios share one array identity. */
export function markers(count: number): MarkerDescriptor[] {
  let cached = markerCache.get(count);
  if (cached == null) {
    cached = generatePolandMarkers(count);
    markerCache.set(count, cached);
  }
  return cached;
}

/** Moves `movingCount` markers by a small deterministic step; returns a new array. */
export function stepMarkers(
  current: MarkerDescriptor[],
  movingCount: number,
  tick: number,
): MarkerDescriptor[] {
  const angle = tick * 0.35;
  const dLat = Math.sin(angle) * 0.0006;
  const dLon = Math.cos(angle) * 0.0009;
  return current.map((marker, index) =>
    index < movingCount
      ? {
          ...marker,
          coordinate: {
            latitude: marker.coordinate.latitude + dLat,
            longitude: marker.coordinate.longitude + dLon,
          },
        }
      : marker,
  );
}

/** The same motion as `stepMarkers`, as coordinate-only updates for a collection. */
export function stepPositions(
  base: MarkerDescriptor[],
  movingCount: number,
  tick: number,
): MarkerPositionUpdate[] {
  const angle = tick * 0.35;
  const dLat = Math.sin(angle) * 0.0006;
  const dLon = Math.cos(angle) * 0.0009;
  const updates: MarkerPositionUpdate[] = [];
  for (let index = 0; index < movingCount && index < base.length; index += 1) {
    const marker = base[index];
    updates.push({
      id: marker.id,
      coordinate: {
        latitude: marker.coordinate.latitude + dLat * tick,
        longitude: marker.coordinate.longitude + dLon * tick,
      },
    });
  }
  return updates;
}

/** A sinuous 5,000-point route from Gdańsk down to Kraków. */
export function longRoute(
  points = 5_000,
  strokeColor = '#FF3B30',
): PolylineDescriptor {
  const coordinates = [];
  const startLat = 54.35;
  const endLat = 50.06;
  for (let index = 0; index < points; index += 1) {
    const t = index / (points - 1);
    coordinates.push({
      latitude: startLat + (endLat - startLat) * t,
      longitude:
        19.0 + Math.sin(t * Math.PI * 6) * 0.6 + Math.sin(t * 90) * 0.02,
    });
  }
  return { id: 'route', coordinates, strokeColor, strokeWidth: 4 };
}

/** A grid of 200 small squares around Warsaw. */
export function polygonGrid(count = 200): PolygonDescriptor[] {
  const columns = 20;
  const size = 0.006;
  const gap = 0.009;
  const polygons: PolygonDescriptor[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const lat = WARSAW_REGION.latitude - 0.05 + row * gap;
    const lon = WARSAW_REGION.longitude - 0.09 + column * gap;
    polygons.push({
      id: `cell-${index}`,
      coordinates: [
        { latitude: lat, longitude: lon },
        { latitude: lat + size, longitude: lon },
        { latitude: lat + size, longitude: lon + size },
        { latitude: lat, longitude: lon + size },
      ],
      fillColor: '#007AFF33',
      strokeColor: '#007AFF',
      strokeWidth: 1,
    });
  }
  return polygons;
}
