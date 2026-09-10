import type { Coordinate, MapViewProps } from 'react-native-better-maps';
import { Random, round } from './prng';
import { DEFAULT_SEED } from './markers';
import { WARSAW_CENTER } from './regions';

export type PolylineDescriptor = NonNullable<MapViewProps['polylines']>[number];

export interface PolylineFixtureOptions {
  seed?: number;
  start?: Coordinate;
  /** Average distance between consecutive points, in degrees. */
  stepDegrees?: number;
  strokeColor?: string;
  strokeWidth?: number;
  id?: string;
}

const METERS_PER_DEGREE_LAT = 111_320;

/**
 * A smooth random walk (heading drifts slowly, so the line looks like a
 * route rather than noise). Point count drives the JS payload and the
 * native path construction cost.
 */
export function generatePolylineCoordinates(
  points: number,
  options: PolylineFixtureOptions = {},
): Coordinate[] {
  const { seed = DEFAULT_SEED, start = WARSAW_CENTER } = options;
  const random = new Random(seed ^ (points * 31));
  // Scale the step so 100 points and 100k points both stay within ~30 km.
  const stepDegrees =
    options.stepDegrees ?? Math.min(0.0025, 0.3 / Math.max(points, 1));
  const coordinates: Coordinate[] = new Array(points);
  let latitude = start.latitude;
  let longitude = start.longitude;
  let heading = random.range(0, Math.PI * 2);

  for (let index = 0; index < points; index += 1) {
    coordinates[index] = {
      latitude: round(latitude),
      longitude: round(longitude),
    };
    heading += random.gaussian() * 0.35;
    // Bias back toward the start so long routes orbit the city instead of leaving.
    const toStartLat = start.latitude - latitude;
    const toStartLon = start.longitude - longitude;
    const distance = Math.hypot(toStartLat, toStartLon);
    if (distance > 0.25) {
      heading = Math.atan2(toStartLat, toStartLon) + random.gaussian() * 0.2;
    }
    latitude += Math.sin(heading) * stepDegrees;
    longitude +=
      (Math.cos(heading) * stepDegrees) / Math.cos((latitude * Math.PI) / 180);
  }

  return coordinates;
}

export function generatePolyline(
  points: number,
  options: PolylineFixtureOptions = {},
): PolylineDescriptor {
  return {
    id: options.id ?? `route-${points}`,
    coordinates: generatePolylineCoordinates(points, options),
    strokeColor: options.strokeColor ?? '#007AFF',
    strokeWidth: options.strokeWidth ?? 4,
  };
}

/** `count` polylines of `pointsEach` points scattered around the city. */
export function generatePolylines(
  count: number,
  pointsEach: number,
  seed = DEFAULT_SEED,
): PolylineDescriptor[] {
  const random = new Random(seed ^ (count * 17 + pointsEach));
  const result: PolylineDescriptor[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    result[index] = generatePolyline(pointsEach, {
      id: `route-${index}`,
      seed: seed + index,
      start: {
        latitude: WARSAW_CENTER.latitude + random.gaussian() * 0.04,
        longitude: WARSAW_CENTER.longitude + random.gaussian() * 0.06,
      },
      strokeColor: random.pick(['#007AFF', '#FF9500', '#34C759', '#AF52DE']),
      strokeWidth: 3,
    });
  }
  return result;
}

/** Approximate length in meters, useful for documenting fixture scale. */
export function polylineLengthMeters(coordinates: Coordinate[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const a = coordinates[index - 1];
    const b = coordinates[index];
    const dLat = (b.latitude - a.latitude) * METERS_PER_DEGREE_LAT;
    const dLon =
      (b.longitude - a.longitude) *
      METERS_PER_DEGREE_LAT *
      Math.cos((a.latitude * Math.PI) / 180);
    total += Math.hypot(dLat, dLon);
  }
  return total;
}
