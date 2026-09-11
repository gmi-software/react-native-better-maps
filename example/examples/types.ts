import type {
  EdgePadding,
  GeojsonInput,
  GeojsonProps,
  MapViewProps,
  Region,
} from 'react-native-better-maps';

export interface MapScenarioAdvancedOptions {
  clusteringEnabled?: boolean;
  showsUserLocation?: boolean;
  followsUserLocation?: boolean;
  showsCompass?: boolean;
  showsScale?: boolean;
  customMapStyle?: string;
  mapPadding?: EdgePadding;
  fitToCoordinatesOnReady?: boolean;
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
