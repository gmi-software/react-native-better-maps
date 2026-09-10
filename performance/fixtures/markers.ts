import type { MarkerDescriptor } from 'react-native-better-maps';
import { Random, round } from './prng';
import { POLAND_BOUNDS, type BoundingBox } from './regions';

export type MarkerDistribution = 'cities' | 'uniform';

export interface MarkerFixtureOptions {
  /** Seed for the generator; the default is the lab-wide fixed seed. */
  seed?: number;
  /** `cities`: Gaussian blobs around Polish cities weighted by population, plus 12% rural scatter. */
  distribution?: MarkerDistribution;
  bounds?: BoundingBox;
  /** Adds `title` and `subtitle` strings (extra payload per marker). */
  withTitles?: boolean;
  /** Adds rotation/opacity/anchor fields to exercise optional-field conversion. */
  rich?: boolean;
  /** Value of `clusterable` written on each marker; omit to leave it undefined. */
  clusterable?: boolean;
}

export const DEFAULT_SEED = 12345;

type CityHotspot = { latitude: number; longitude: number; weight: number };

/** Major Polish cities weighted roughly by population. */
const POLAND_CITIES: readonly CityHotspot[] = [
  { latitude: 52.2297, longitude: 21.0122, weight: 1.8 }, // Warsaw
  { latitude: 50.0647, longitude: 19.945, weight: 0.78 }, // Kraków
  { latitude: 51.7592, longitude: 19.456, weight: 0.68 }, // Łódź
  { latitude: 51.1079, longitude: 17.0385, weight: 0.64 }, // Wrocław
  { latitude: 52.4064, longitude: 16.9252, weight: 0.54 }, // Poznań
  { latitude: 54.352, longitude: 18.6466, weight: 0.47 }, // Gdańsk
  { latitude: 53.4285, longitude: 14.5528, weight: 0.4 }, // Szczecin
  { latitude: 53.1235, longitude: 18.0084, weight: 0.35 }, // Bydgoszcz
  { latitude: 51.2465, longitude: 22.5684, weight: 0.34 }, // Lublin
  { latitude: 50.2649, longitude: 19.0238, weight: 0.5 }, // Katowice
  { latitude: 53.1325, longitude: 23.1688, weight: 0.3 }, // Białystok
  { latitude: 50.0413, longitude: 21.999, weight: 0.2 }, // Rzeszów
];

const TITLE_WORDS = [
  'Depot',
  'Store',
  'Cafe',
  'Hub',
  'Station',
  'Point',
  'Market',
  'Office',
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Generates `count` markers deterministically. Calling this twice with the
 * same arguments yields byte-identical descriptors (see fixtures tests).
 */
export function generateMarkers(
  count: number,
  options: MarkerFixtureOptions = {},
): MarkerDescriptor[] {
  const {
    seed = DEFAULT_SEED,
    distribution = 'cities',
    bounds = POLAND_BOUNDS,
    withTitles = false,
    rich = false,
    clusterable,
  } = options;
  const random = new Random(seed ^ count);
  const totalWeight = POLAND_CITIES.reduce((sum, city) => sum + city.weight, 0);
  const markers: MarkerDescriptor[] = new Array(count);

  for (let index = 0; index < count; index += 1) {
    let latitude: number;
    let longitude: number;

    if (distribution === 'uniform' || random.next() < 0.12) {
      latitude = random.range(bounds.minLatitude, bounds.maxLatitude);
      longitude = random.range(bounds.minLongitude, bounds.maxLongitude);
    } else {
      let pick = random.next() * totalWeight;
      let city = POLAND_CITIES[0];
      for (const candidate of POLAND_CITIES) {
        pick -= candidate.weight;
        if (pick <= 0) {
          city = candidate;
          break;
        }
      }
      const spread = 0.1 + city.weight * 0.16;
      latitude = city.latitude + random.gaussian() * spread;
      longitude = city.longitude + random.gaussian() * spread * 1.4;
    }

    const marker: MarkerDescriptor = {
      id: `m-${index}`,
      coordinate: {
        latitude: round(
          clamp(latitude, bounds.minLatitude, bounds.maxLatitude),
        ),
        longitude: round(
          clamp(longitude, bounds.minLongitude, bounds.maxLongitude),
        ),
      },
    };
    if (clusterable !== undefined) {
      marker.clusterable = clusterable;
    }
    if (withTitles) {
      marker.title = `${random.pick(TITLE_WORDS)} ${index}`;
      marker.subtitle = `Fixture marker #${index}`;
    }
    if (rich) {
      marker.rotation = random.int(0, 359);
      marker.opacity = round(random.range(0.5, 1), 2);
      marker.anchor = { x: 0.5, y: 1 };
      marker.flat = index % 2 === 0;
    }
    markers[index] = marker;
  }

  return markers;
}
