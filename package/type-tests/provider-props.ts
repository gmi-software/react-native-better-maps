import type {
  ApplePoiCategory,
  MapViewProps,
  MapViewPropsForProvider,
} from '../src';

export const appleProps: MapViewPropsForProvider<'apple'> = {
  provider: 'apple',
  showsBuildings: false,
  showsScale: true,
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
  showsBuildings: true,
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
  showsBuildings: false,
  showsScale: true,
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
