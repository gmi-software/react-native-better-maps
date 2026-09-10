import type { Coordinate, MapViewProps } from 'react-native-better-maps';
import { Random, round } from './prng';
import { DEFAULT_SEED } from './markers';
import { WARSAW_CENTER } from './regions';

export type PolygonDescriptor = NonNullable<MapViewProps['polygons']>[number];

export interface PolygonFixtureOptions {
  seed?: number;
  center?: Coordinate;
  /** Mean radius in degrees of latitude. */
  radiusDegrees?: number;
  id?: string;
  fillColor?: string;
  strokeColor?: string;
}

/**
 * A star-shaped ring: `points` vertices at evenly spaced angles with a
 * smoothly varying radius, so every polygon is simple (non-self-intersecting)
 * and the vertex count is the only thing that scales.
 */
export function generatePolygonCoordinates(
  points: number,
  options: PolygonFixtureOptions = {},
): Coordinate[] {
  const {
    seed = DEFAULT_SEED,
    center = WARSAW_CENTER,
    radiusDegrees = 0.03,
  } = options;
  const random = new Random(seed ^ (points * 13));
  const harmonics = [
    {
      k: 2,
      amplitude: random.range(0.05, 0.15),
      phase: random.range(0, Math.PI * 2),
    },
    {
      k: 5,
      amplitude: random.range(0.03, 0.08),
      phase: random.range(0, Math.PI * 2),
    },
    {
      k: 11,
      amplitude: random.range(0.01, 0.04),
      phase: random.range(0, Math.PI * 2),
    },
  ];
  const coordinates: Coordinate[] = new Array(points);
  const cosLat = Math.cos((center.latitude * Math.PI) / 180);

  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    let radius = radiusDegrees;
    for (const { k, amplitude, phase } of harmonics) {
      radius += radiusDegrees * amplitude * Math.sin(k * angle + phase);
    }
    coordinates[index] = {
      latitude: round(center.latitude + Math.sin(angle) * radius),
      longitude: round(center.longitude + (Math.cos(angle) * radius) / cosLat),
    };
  }

  return coordinates;
}

export function generatePolygon(
  points: number,
  options: PolygonFixtureOptions = {},
): PolygonDescriptor {
  return {
    id: options.id ?? `area-${points}`,
    coordinates: generatePolygonCoordinates(points, options),
    fillColor: options.fillColor ?? '#34C75944',
    strokeColor: options.strokeColor ?? '#34C759',
    strokeWidth: 2,
  };
}

/** A grid of `count` polygons with `pointsEach` vertices each, around the city. */
export function generatePolygons(
  count: number,
  pointsEach: number,
  seed = DEFAULT_SEED,
): PolygonDescriptor[] {
  const columns = Math.ceil(Math.sqrt(count));
  const spacing = 0.012;
  const result: PolygonDescriptor[] = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    result[index] = generatePolygon(pointsEach, {
      id: `area-${index}`,
      seed: seed + index,
      radiusDegrees: spacing * 0.4,
      center: {
        latitude:
          WARSAW_CENTER.latitude - (columns / 2) * spacing + row * spacing,
        longitude:
          WARSAW_CENTER.longitude -
          (columns / 2) * spacing * 1.5 +
          column * spacing * 1.5,
      },
      fillColor: index % 2 === 0 ? '#34C75944' : '#FF950044',
      strokeColor: index % 2 === 0 ? '#34C759' : '#FF9500',
    });
  }
  return result;
}
