import { advancedFeaturesScenario } from './advancedFeatures';
import { allOverlaysScenario } from './allOverlays';
import {
  APPLE_POI_DETAILS_DEFAULT_PRESENTATION,
  APPLE_POI_DETAILS_SCENARIO_ID,
  applePoiDetailsScenario,
  createApplePoiDetailsScenario,
  nextApplePoiDetailPresentation,
} from './applePoiDetails';
import {
  createCustomMarkerImagesScenario,
  customMarkerImagesScenario,
  CUSTOM_MARKER_IMAGES_SCENARIO_ID,
} from './customMarkerImages';
import { deliveryZoneScenario } from './deliveryZone';
import { geojsonScenario } from './geojson';
import { landmarksScenario } from './landmarks';
import { mountEffectCameraScenario } from './mountEffectCamera';
import { createScenarioOverlayProps } from './overlaySource';
import {
  createQuietMapScenario,
  nextQuietMapPointsOfInterestIndex,
  pointsOfInterestLabel,
  QUIET_MAP_DEFAULT_POINTS_OF_INTEREST_INDEX,
  QUIET_MAP_SCENARIO_ID,
  quietMapScenario,
} from './quietMap';
import { riverRouteScenario } from './riverRoute';
import type { MapScenario } from './types';

export type { MapScenario } from './types';
export {
  APPLE_POI_DETAILS_DEFAULT_PRESENTATION,
  APPLE_POI_DETAILS_SCENARIO_ID,
  createApplePoiDetailsScenario,
  createCustomMarkerImagesScenario,
  createScenarioOverlayProps,
  createQuietMapScenario,
  CUSTOM_MARKER_IMAGES_SCENARIO_ID,
  nextApplePoiDetailPresentation,
  nextQuietMapPointsOfInterestIndex,
  pointsOfInterestLabel,
  QUIET_MAP_DEFAULT_POINTS_OF_INTEREST_INDEX,
  QUIET_MAP_SCENARIO_ID,
};

export const MAP_SCENARIOS: MapScenario[] = [
  allOverlaysScenario,
  landmarksScenario,
  customMarkerImagesScenario,
  riverRouteScenario,
  deliveryZoneScenario,
  geojsonScenario,
  advancedFeaturesScenario,
  applePoiDetailsScenario,
  quietMapScenario,
  mountEffectCameraScenario,
];
