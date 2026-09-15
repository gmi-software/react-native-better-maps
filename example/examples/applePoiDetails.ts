import type {
  ApplePoiDetailPresentation,
  Region,
} from 'react-native-better-maps';
import type { MapScenario } from './types';

export const APPLE_POI_DETAILS_SCENARIO_ID = 'apple-poi-details';

export const APPLE_POI_DETAILS_DEFAULT_PRESENTATION: ApplePoiDetailPresentation =
  'callout';

/** Cycle order for the presentation picker; exhaustive by construction. */
const NEXT_PRESENTATION: Record<
  ApplePoiDetailPresentation,
  ApplePoiDetailPresentation
> = {
  automatic: 'callout',
  callout: 'sheet',
  sheet: 'openInMaps',
  openInMaps: 'automatic',
};

export function nextApplePoiDetailPresentation(
  current: ApplePoiDetailPresentation,
): ApplePoiDetailPresentation {
  return NEXT_PRESENTATION[current];
}

/** Kraków's Main Square, dense with MapKit points of interest. */
const KRAKOW_MAIN_SQUARE: Region = {
  latitude: 50.0617,
  longitude: 19.9373,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

/**
 * Native MapKit place details (callout, sheet, Open in Maps). Apple Maps on
 * iOS 18+ only; Google Maps stays event-only.
 */
export function createApplePoiDetailsScenario(
  applePoiDetailPresentation: ApplePoiDetailPresentation,
): MapScenario {
  return {
    id: APPLE_POI_DETAILS_SCENARIO_ID,
    name: 'Apple POI details',
    description:
      'Tap a place to open native MapKit details. Apple Maps on iOS 18+ only; Google Maps stays event-only.',
    region: KRAKOW_MAIN_SQUARE,
    advanced: { applePoiDetailPresentation },
  };
}

export const applePoiDetailsScenario = createApplePoiDetailsScenario(
  APPLE_POI_DETAILS_DEFAULT_PRESENTATION,
);
