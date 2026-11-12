import type { PointsOfInterest, Region } from 'react-native-better-maps';
import type { MapScenario } from './types';

export const QUIET_MAP_SCENARIO_ID = 'quiet-map';

/** Cycle order for the POI filter toggle. */
const POINTS_OF_INTEREST_OPTIONS: PointsOfInterest[] = [
  'none',
  'all',
  { exclude: ['restaurant', 'store'] },
];

export const QUIET_MAP_DEFAULT_POINTS_OF_INTEREST_INDEX = 0;

export function nextQuietMapPointsOfInterestIndex(current: number): number {
  return (current + 1) % POINTS_OF_INTEREST_OPTIONS.length;
}

export function pointsOfInterestLabel(
  pointsOfInterest: PointsOfInterest,
): string {
  if (typeof pointsOfInterest === 'string') {
    return pointsOfInterest;
  }
  return 'include' in pointsOfInterest && pointsOfInterest.include != null
    ? `only ${pointsOfInterest.include.join(', ')}`
    : `no ${(pointsOfInterest.exclude ?? []).join(', ')}`;
}

/** Kraków's Main Square, dense with shops and restaurants. */
const KRAKOW_MAIN_SQUARE: Region = {
  latitude: 50.0617,
  longitude: 19.9373,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

/**
 * Apple's muted map with the provider's points of interest filtered out, for
 * apps that draw their own pins. Google Maps has no muted map and shows the
 * standard one.
 */
export function createQuietMapScenario(
  pointsOfInterestIndex: number,
): MapScenario {
  return {
    id: QUIET_MAP_SCENARIO_ID,
    name: 'Quiet map',
    description:
      'Muted map type with points of interest filtered. The muted map is Apple-only; Google shows the standard map.',
    region: KRAKOW_MAIN_SQUARE,
    advanced: {
      mapType: 'mutedStandard',
      pointsOfInterest:
        POINTS_OF_INTEREST_OPTIONS[pointsOfInterestIndex] ?? 'none',
    },
  };
}

export const quietMapScenario = createQuietMapScenario(
  QUIET_MAP_DEFAULT_POINTS_OF_INTEREST_INDEX,
);
