import type { MapScenario } from './types';

export const APPLE_POI_DETAILS_SCENARIO_ID = 'apple-poi-details';

/**
 * Native MapKit place details (callout, sheet, Open in Maps) around Kraków's
 * Main Square. Apple Maps on iOS 18+ only; Google Maps stays event-only.
 */
export const applePoiDetailsScenario: MapScenario = {
  id: APPLE_POI_DETAILS_SCENARIO_ID,
  name: 'Apple POI details',
  description:
    'Tap a place to open native MapKit details. Apple Maps on iOS 18+ only; Google Maps stays event-only.',
  region: {
    latitude: 50.0617,
    longitude: 19.9373,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  },
  advanced: {
    applePoiDetailPresentation: 'callout',
  },
};
