import type { MapScenario } from './types';

/** Approximate mainland Poland bounding box. */
const POLAND_BOUNDS = {
  minLatitude: 49.002,
  maxLatitude: 54.835,
  minLongitude: 14.123,
  maxLongitude: 24.145,
};

const POLAND_CENTER = {
  latitude: (POLAND_BOUNDS.minLatitude + POLAND_BOUNDS.maxLatitude) / 2,
  longitude: (POLAND_BOUNDS.minLongitude + POLAND_BOUNDS.maxLongitude) / 2,
};

type CityHotspot = { latitude: number; longitude: number; weight: number };

/** Major Polish cities weighted roughly by population (clustering hotspots). */
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
  { latitude: 50.2649, longitude: 19.0238, weight: 0.5 }, // Katowice (GZM)
  { latitude: 53.1325, longitude: 23.1688, weight: 0.3 }, // Białystok
  { latitude: 50.0413, longitude: 21.999, weight: 0.2 }, // Rzeszów
];

/** Deterministic PRNG so the demo distribution is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Distributes markers naturally: Gaussian blobs around major cities (weighted
 * by population) plus a sparse rural scatter. This makes clustering look
 * organic instead of a rigid lattice.
 */
export function generatePolandMarkers(
  count: number,
): NonNullable<MapScenario['markers']> {
  const rng = mulberry32(0x5eed);
  const gaussian = () => {
    const u = Math.max(rng(), 1e-9);
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const totalWeight = POLAND_CITIES.reduce((sum, city) => sum + city.weight, 0);
  const markers: NonNullable<MapScenario['markers']> = [];

  for (let index = 0; index < count; index += 1) {
    let latitude: number;
    let longitude: number;

    if (rng() < 0.12) {
      latitude =
        POLAND_BOUNDS.minLatitude +
        rng() * (POLAND_BOUNDS.maxLatitude - POLAND_BOUNDS.minLatitude);
      longitude =
        POLAND_BOUNDS.minLongitude +
        rng() * (POLAND_BOUNDS.maxLongitude - POLAND_BOUNDS.minLongitude);
    } else {
      let pick = rng() * totalWeight;
      let city = POLAND_CITIES[0];
      for (const candidate of POLAND_CITIES) {
        pick -= candidate.weight;
        if (pick <= 0) {
          city = candidate;
          break;
        }
      }
      const spread = 0.1 + city.weight * 0.16;
      latitude = city.latitude + gaussian() * spread;
      longitude = city.longitude + gaussian() * spread * 1.4;
    }

    markers.push({
      id: `pl-${index}`,
      coordinate: {
        latitude: clamp(
          latitude,
          POLAND_BOUNDS.minLatitude,
          POLAND_BOUNDS.maxLatitude,
        ),
        longitude: clamp(
          longitude,
          POLAND_BOUNDS.minLongitude,
          POLAND_BOUNDS.maxLongitude,
        ),
      },
      clusterable: true,
    });
  }

  return markers;
}

/** Minimal dark style JSON (hides POIs) for custom map style demos. */
export const POI_HIDDEN_MAP_STYLE = JSON.stringify([
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
]);

export const advancedFeaturesScenario: MapScenario = {
  id: 'advanced-features',
  name: 'Advanced features',
  description:
    '10k clustered markers across Poland, compass/scale, map padding, and custom style',
  region: {
    latitude: POLAND_CENTER.latitude,
    longitude: POLAND_CENTER.longitude,
    latitudeDelta: 6.2,
    longitudeDelta: 10.5,
  },
  markers: generatePolandMarkers(10_000),
  advanced: {
    clusteringEnabled: true,
    showsCompass: true,
    showsScale: true,
    mapPadding: { top: 56, right: 52, bottom: 160, left: 12 },
    customMapStyle: POI_HIDDEN_MAP_STYLE,
    fitToCoordinatesOnReady: false,
  },
};
