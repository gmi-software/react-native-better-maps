import type {
  ApplePoiCategory,
  MapViewProps,
  MapViewPropsForProvider,
  PoiCategory,
  Region,
} from '../src';

export const appleProps: MapViewPropsForProvider<'apple'> = {
  provider: 'apple',
  showsScale: true,
  applePoiDetailPresentation: 'callout',
  clusteringEnabled: true,
  markerEnteringAnimation: { preset: 'fade-scale', duration: 180 },
  clusterEnteringAnimation: 'system',
  onPoiPress: (event) => {
    event.category satisfies ApplePoiCategory;
    // @ts-expect-error Apple POI events do not include Google place IDs.
    event.placeId satisfies string;
  },
};

export const googleProps: MapViewPropsForProvider<'google'> = {
  provider: 'google',
  googleMapId: 'google-map-id',
  customMapStyle: '[]',
  clusteringEnabled: true,
  clusterEnteringAnimation: false,
  onPoiPress: (event) => {
    event.placeId satisfies string;
    // @ts-expect-error Google POI events do not include Apple categories.
    event.category satisfies string;
  },
};

export const defaultProviderProps: MapViewProps = {
  showsScale: true,
  applePoiDetailPresentation: 'sheet',
  customMapStyle: '[]',
  markerEnteringAnimation: false,
  onPoiPress: (event) => {
    if (event.provider === 'google') {
      event.placeId satisfies string;
    } else {
      event.category satisfies ApplePoiCategory;
    }
  },
  markers: [
    {
      id: 'marker-1',
      coordinate: { latitude: 52.2297, longitude: 21.0122 },
      enteringAnimation: { preset: 'fade', reduceMotion: 'system' },
    },
  ],
};

// @ts-expect-error Google Map IDs require the explicit Google provider.
export const defaultProviderGoogleMapIdProps: MapViewProps = {
  googleMapId: 'google-map-id',
};

export const regionChangeProps: MapViewProps = {
  onRegionChange: (region, details) => {
    region satisfies Region;
    details.isGesture satisfies boolean;
  },
  onRegionChangeComplete: (region, details) => {
    region satisfies Region;
    // @ts-expect-error The details carry the gesture flag, not the region.
    details.latitude satisfies number;
  },
};

export const plannedProviderProps: MapViewProps = {
  provider: 'mapbox',
};

export const googleScaleProps: MapViewPropsForProvider<'google'> = {
  provider: 'google',
  // @ts-expect-error Google Maps SDK does not expose a native scale control.
  showsScale: true,
};

export const appleMapIdProps: MapViewPropsForProvider<'apple'> = {
  provider: 'apple',
  // @ts-expect-error Google Map IDs are only supported by the Google provider.
  googleMapId: 'google-map-id',
};

export const openStreetMapClusteringProps: MapViewPropsForProvider<'openstreetmap'> =
  {
    provider: 'openstreetmap',
    // @ts-expect-error Planned OpenStreetMap support has no clustering capability yet.
    clusteringEnabled: true,
  };

export const openStreetMapClusterAnimationProps: MapViewPropsForProvider<'openstreetmap'> =
  {
    provider: 'openstreetmap',
    // @ts-expect-error Planned OpenStreetMap support has no cluster animation capability yet.
    clusterEnteringAnimation: { preset: 'fade' },
  };

export const openStreetMapPoiPressProps: MapViewPropsForProvider<'openstreetmap'> =
  {
    provider: 'openstreetmap',
    // @ts-expect-error Planned OpenStreetMap support has no native POI press capability yet.
    onPoiPress: () => {},
  };

export const mapboxClusterAnimationProps: MapViewPropsForProvider<'mapbox'> = {
  provider: 'mapbox',
  // @ts-expect-error Planned Mapbox support has no cluster animation capability yet.
  clusterEnteringAnimation: { preset: 'fade' },
};

export const mapboxPoiPressProps: MapViewPropsForProvider<'mapbox'> = {
  provider: 'mapbox',
  // @ts-expect-error Planned Mapbox support has no native POI press capability yet.
  onPoiPress: () => {},
};

export const googleApplePoiDetailProps: MapViewPropsForProvider<'google'> = {
  provider: 'google',
  // @ts-expect-error Google Maps has no native POI detail surface; POI taps stay event-only.
  applePoiDetailPresentation: 'callout',
};

export const openStreetMapApplePoiDetailProps: MapViewPropsForProvider<'openstreetmap'> =
  {
    provider: 'openstreetmap',
    // @ts-expect-error Planned OpenStreetMap support has no native POI detail surface.
    applePoiDetailPresentation: 'callout',
  };

export const mapboxApplePoiDetailProps: MapViewPropsForProvider<'mapbox'> = {
  provider: 'mapbox',
  // @ts-expect-error Planned Mapbox support has no native POI detail surface.
  applePoiDetailPresentation: 'callout',
};

export const applePointsOfInterestProps: MapViewPropsForProvider<'apple'> = {
  provider: 'apple',
  mapType: 'mutedStandard',
  pointsOfInterest: { exclude: ['restaurant', 'store'] },
};

export const googlePointsOfInterestProps: MapViewPropsForProvider<'google'> = {
  provider: 'google',
  mapType: 'mutedStandard',
  pointsOfInterest: 'none',
};

export const defaultProviderPointsOfInterestProps: MapViewProps = {
  pointsOfInterest: { include: ['park', 'museum'] satisfies PoiCategory[] },
};

export const unknownPoiCategoryProps: MapViewProps = {
  // @ts-expect-error `unknown` only describes POI press events, not a category to filter by.
  pointsOfInterest: { include: ['unknown'] },
};

export const includeAndExcludePoiProps: MapViewProps = {
  // @ts-expect-error A POI filter either includes or excludes categories, not both.
  pointsOfInterest: { include: ['park'], exclude: ['store'] },
};

export const openStreetMapPointsOfInterestProps: MapViewPropsForProvider<'openstreetmap'> =
  {
    provider: 'openstreetmap',
    // @ts-expect-error Planned OpenStreetMap support has no POI filter yet.
    pointsOfInterest: 'none',
  };

export const mapboxPointsOfInterestProps: MapViewPropsForProvider<'mapbox'> = {
  provider: 'mapbox',
  // @ts-expect-error Planned Mapbox support has no POI filter yet.
  pointsOfInterest: 'none',
};
