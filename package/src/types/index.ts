export type { Coordinate } from './coordinate';
export type { Camera } from './camera';
export type { Region, EdgePadding, VisibleRegion } from './region';
export type {
  ApplePoiCategory,
  MarkerPinStyle,
  MarkerRendering,
} from '../native/specs/MapView.nitro';
export type {
  ApplePoiPressEvent,
  ClusterPressEvent,
  GooglePoiPressEvent,
  MapProvider,
  MapType,
  MapViewProps,
  MapViewPropsForProvider,
  PoiPressEvent,
} from './map';
export type {
  MarkerAnchor,
  MarkerImage,
  MarkerImageSource,
  MarkerDescriptor,
  MarkerPoint,
  MarkerProps,
  OverlayEnteringAnimation,
  OverlayEnteringAnimationConfig,
  OverlayEnteringAnimationPreset,
  OverlayEnteringAnimationReduceMotion,
  PolylineProps,
  PolygonProps,
  CircleProps,
} from './overlays';
export type {
  GeojsonFeature,
  GeojsonFeatureCollection,
  GeojsonGeometry,
  GeojsonInput,
  GeojsonOverlayDescriptors,
  GeojsonProps,
  GeojsonToOverlayOptions,
} from './geojson';
export type { MapViewRef } from './ref';
