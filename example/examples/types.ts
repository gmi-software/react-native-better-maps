import type {
  ApplePoiDetailPresentation,
  Coordinate,
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
  applePoiDetailPresentation?: ApplePoiDetailPresentation;
  customMapStyle?: string;
  mapPadding?: EdgePadding;
  fitToCoordinatesOnReady?: boolean;
  fitToCoordinatesOnMount?: boolean;
}

/** A place drawn as a live `MarkerView`. */
export interface LivePlace {
  id: string;
  coordinate: Coordinate;
  price: number;
  isHot: boolean;
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
  /** Drawn as `MarkerView` children, with JSX cluster badges. */
  livePlaces?: LivePlace[];
  geojsonStyle?: Pick<
    GeojsonProps,
    'strokeColor' | 'fillColor' | 'strokeWidth'
  >;
  advanced?: MapScenarioAdvancedOptions;
}
