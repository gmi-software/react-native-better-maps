export { Random, mulberry32, splitmix32, round } from './prng';
export {
  DEFAULT_SEED,
  generateMarkers,
  type MarkerDistribution,
  type MarkerFixtureOptions,
} from './markers';
export {
  generatePolyline,
  generatePolylineCoordinates,
  generatePolylines,
  polylineLengthMeters,
  type PolylineDescriptor,
  type PolylineFixtureOptions,
} from './polylines';
export {
  generatePolygon,
  generatePolygonCoordinates,
  generatePolygons,
  type PolygonDescriptor,
  type PolygonFixtureOptions,
} from './polygons';
export {
  appendMarker,
  moveFirstMarkers,
  moveMarkerFraction,
  moveMarkers,
  perturbPolyline,
  pickIndices,
  removeLastMarker,
  restylePolyline,
} from './mutations';
export {
  POLAND_BOUNDS,
  POLAND_CAMERA,
  POLAND_CENTER,
  POLAND_REGION,
  WARSAW_CAMERA,
  WARSAW_CENTER,
  WARSAW_REGION,
  cameraAt,
  type BoundingBox,
} from './regions';
export { fnv1a64, hashJson } from './hash';

import type { MarkerDescriptor } from 'react-native-better-maps';
import { generateMarkers, type MarkerFixtureOptions } from './markers';

const markerCache = new Map<string, MarkerDescriptor[]>();

/**
 * Memoized marker fixtures so scenarios that share a dataset also share one
 * array identity (prop diffing then sees "unchanged" until a mutation).
 */
export function markers(
  count: number,
  options: MarkerFixtureOptions = {},
): MarkerDescriptor[] {
  const key = `${count}:${JSON.stringify(options)}`;
  let cached = markerCache.get(key);
  if (cached == null) {
    cached = generateMarkers(count, options);
    markerCache.set(key, cached);
  }
  return cached;
}

/** Drops memoized fixtures (used between scenarios to release memory). */
export function clearFixtureCache(): void {
  markerCache.clear();
}
