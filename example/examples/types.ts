import type {
  ApplePoiDetailPresentation,
  EdgePadding,
  GeojsonInput,
  GeojsonProps,
  MapType,
  MapViewProps,
  PointsOfInterest,
  Region,
} from 'react-native-better-maps';

export interface MapScenarioAdvancedOptions {
  clusteringEnabled?: boolean;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  applePoiDetailPresentation?: ApplePoiDetailPresentation;
  customMapStyle?: string;
  /** Map type the scenario starts with; the map type button still cycles. */
  mapType?: MapType;
  pointsOfInterest?: PointsOfInterest;
  mapPadding?: EdgePadding;
  fitToCoordinatesOnReady?: boolean;
  fitToCoordinatesOnMount?: boolean;
}

export interface MapScenario {
  id: string;
  name: string;
  description: string;
  region: Region;
  markers?: NonNullable<MapViewProps['markers']>;
  polylines?: NonNullable<MapViewProps['polylines']>;
  polygons?: NonNullable<MapViewProps['polygons']>;
  circles?: NonNullable<MapViewProps['circles']>;
  geojson?: GeojsonInput;
  geojsonStyle?: Pick<
    GeojsonProps,
    'strokeColor' | 'fillColor' | 'strokeWidth'
  >;
  advanced?: MapScenarioAdvancedOptions;
}
