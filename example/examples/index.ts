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
import { riverRouteScenario } from './riverRoute';
import type { MapScenario } from './types';

export type { MapScenario } from './types';
export {
  APPLE_POI_DETAILS_DEFAULT_PRESENTATION,
  APPLE_POI_DETAILS_SCENARIO_ID,
  createApplePoiDetailsScenario,
  createCustomMarkerImagesScenario,
  createScenarioOverlayProps,
  CUSTOM_MARKER_IMAGES_SCENARIO_ID,
  nextApplePoiDetailPresentation,
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
  mountEffectCameraScenario,
];
