import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Camera } from './camera';
import type { Coordinate } from './coordinate';
import type {
  CircleDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import type {
  ApplePoiCategory,
  ApplePoiDetailPresentation,
  ClusterPressBehavior,
} from '../native/specs/MapView.nitro';
import type {
  ClusterStyle,
  MarkerDescriptor,
  OverlayEnteringAnimation,
} from './overlays';
import type { EdgePadding, Region, RegionChangeDetails } from './region';

/**
 * Available map display styles.
 *
 * `mutedStandard` is Apple's low-contrast standard map, for apps that draw
 * their own content on top. Google Maps has no muted map and shows `standard`.
 */
export type MapType =
  'standard' | 'mutedStandard' | 'satellite' | 'hybrid' | 'terrain';

/**
 * A category of provider-owned points of interest, after MapKit's
 * `MKPointOfInterestCategory`. Google Maps groups POIs more coarsely; see
 * {@linkcode PointsOfInterest}.
 */
export type PoiCategory = Exclude<ApplePoiCategory, 'unknown'>;

/**
 * Which provider-owned points of interest the base map shows.
 *
 * - `'all'` / `'none'`: every POI, or none.
 * - `{ include }`: only these categories.
 * - `{ exclude }`: every category but these.
 *
 * Apple MapKit filters by category. Categories added in iOS 18 (`beauty`,
 * `castle`, `hiking`, …) are skipped on iOS 16 and 17.
 *
 * Google Maps filters by feature type, so each category stands for its whole
 * group: excluding `restaurant` hides every business (`poi.business`), and
 * including it shows every business. Categories with no Google group (such as
 * `airport`, `beach` or `parking`) are ignored when excluded and stay hidden
 * when included.
 */
export type PointsOfInterest =
  | 'all'
  | 'none'
  | { include: PoiCategory[]; exclude?: never }
  | { exclude: PoiCategory[]; include?: never };

/**
 * Native rendering backend for the map view.
 */
export type MapProvider = 'apple' | 'google' | 'openstreetmap' | 'mapbox';

export interface ApplePoiPressEvent {
  provider: 'apple';
  coordinate: Coordinate;
  name?: string;
  category: ApplePoiCategory;
  rawCategory?: string;
}

export interface GooglePoiPressEvent {
  provider: 'google';
  coordinate: Coordinate;
  name: string;
  placeId: string;
}

export type PoiPressEvent = ApplePoiPressEvent | GooglePoiPressEvent;

/**
 * Props shared by all map providers.
 */
interface BaseMapViewProps<PoiEvent extends PoiPressEvent = PoiPressEvent> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;

  /** Initial or controlled region. */
  region?: Region;

  /** Initial or controlled camera position. */
  camera?: Camera;

  /** Map display style. */
  mapType?: MapType;

  /** Whether the user can interact with the map. */
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;

  /** Whether to show the user's current location on the map. */
  showsUserLocation?: boolean;

  /**
   * Whether the map camera should follow the user's location. Needs
   * `showsUserLocation` as well.
   *
   * Ignored on Android, where Google Maps has no follow mode; debug builds log
   * a warning. Call `animateCamera` from a location listener instead.
   */
  followsUserLocation?: boolean;

  /** Whether to show the compass control. */
  showsCompass?: boolean;

  /**
   * Padding applied to map edges, in density-independent pixels.
   *
   * `region` is fitted into the area the padding leaves over, and
   * `fitToCoordinates` padding is added on top of it.
   */
  mapPadding?: EdgePadding;

  /**
   * Bulk marker descriptors. Prefer this over {@linkcode Marker} children
   * when rendering hundreds or thousands of markers.
   */
  markers?: MarkerDescriptor[];

  /** Bulk polyline descriptors. */
  polylines?: PolylineDescriptor[];

  /** Bulk polygon descriptors. */
  polygons?: PolygonDescriptor[];

  /** Bulk circle descriptors. */
  circles?: CircleDescriptor[];

  /** Called when any marker is pressed. */
  onMarkerPress?: (id: string) => void;

  /** Called when any marker drag ends. */
  onMarkerDragEnd?: (id: string, coordinate: Coordinate) => void;

  /** Called when any polyline is pressed. */
  onPolylinePress?: (id: string) => void;

  /** Called when any polygon is pressed. */
  onPolygonPress?: (id: string) => void;

  /** Called when any circle is pressed. */
  onCirclePress?: (id: string) => void;

  /**
   * Called once when the camera starts to move, with the region it is leaving -
   * not on every frame while it moves.
   *
   * Fires for gestures and for programmatic moves alike - `setCamera`,
   * `animateCamera`, `fitToCoordinates` and the `region` / `camera` props.
   * Use `details.isGesture` to tell the two apart. An update that leaves the
   * camera where it is fires nothing, and neither does the map settling into
   * its first position as it appears.
   */
  onRegionChange?: (region: Region, details: RegionChangeDetails) => void;

  /**
   * Called once when the camera comes to rest, with the region it arrived at
   * and the same `details` as the `onRegionChange` that began the move.
   *
   * @see {@linkcode BaseMapViewProps.onRegionChange}
   */
  onRegionChangeComplete?: (
    region: Region,
    details: RegionChangeDetails,
  ) => void;

  /** Called when the map is ready to use. */
  onMapReady?: () => void;

  /** Called when the user presses the map. */
  onPress?: (coordinate: Coordinate) => void;

  /** Called when the user presses a provider-owned point of interest. */
  onPoiPress?: (event: PoiEvent) => void;

  /** Called when the user long-presses the map. */
  onLongPress?: (coordinate: Coordinate) => void;

  /** Called when a marker cluster is pressed. */
  onClusterPress?: (markerIds: string[], coordinate: Coordinate) => void;

  /** Default entering animation for marker overlays. */
  markerEnteringAnimation?: OverlayEnteringAnimation;
}

/** Shared docs for the providers that support `pointsOfInterest`. */
interface PointsOfInterestProps {
  /**
   * Which provider-owned points of interest the base map shows. Omit to keep
   * the provider's default, which is all of them.
   *
   * On Apple MapKit it overrides the POI rules in `customMapStyle`. On Google
   * Maps it becomes style rules placed before the `customMapStyle` rules, so
   * an explicit `customMapStyle` rule wins. Google Maps ignores styles when
   * `googleMapId` is set; debug builds log a warning.
   *
   * @see {@linkcode PointsOfInterest}
   */
  pointsOfInterest?: PointsOfInterest;
}

interface ExistingDefaultProviderProps
  extends BaseMapViewProps<PoiPressEvent>, PointsOfInterestProps {
  /**
   * Optional provider. When omitted, iOS uses Apple MapKit and Android uses
   * Google Maps.
   */
  provider?: undefined;

  /** Google Map IDs require the explicit Google provider. */
  googleMapId?: never;

  /**
   * Whether to show the scale control. Apple MapKit only: ignored on Android,
   * where the Google Maps SDK has no scale control; debug builds log a warning.
   */
  showsScale?: boolean;

  /**
   * Native MapKit detail presentation for selected points of interest.
   * Apple MapKit on iOS 18+ only; a no-op elsewhere.
   */
  applePoiDetailPresentation?: ApplePoiDetailPresentation;

  /** Custom map style as a JSON string (full support on Google Maps; curated subset on Apple MapKit iOS 16+). */
  customMapStyle?: string;

  /** Whether to cluster nearby markers. */
  clusteringEnabled?: boolean;

  /** Entering animation for marker clusters. */
  clusterEnteringAnimation?: OverlayEnteringAnimation;

  /**
   * What a cluster press does after `onClusterPress` fires. `'zoom'` (the
   * default) fits the camera to the cluster's markers; `'none'` keeps the
   * camera still, for apps that open a list or sheet for the cluster instead.
   */
  clusterPressBehavior?: ClusterPressBehavior;
   * How the cluster badge looks: its colors, border, or an image behind the count. Fields
   * left out keep the default badge's look.
   */
  clusterStyle?: ClusterStyle;
}

interface AppleMapViewProps
  extends BaseMapViewProps<ApplePoiPressEvent>, PointsOfInterestProps {
  provider: 'apple';

  /** Google Map IDs are only supported by the Google provider. */
  googleMapId?: never;

  /** Whether to show the scale control. */
  showsScale?: boolean;

  /**
   * Presents native MapKit details for a selected point of interest on
   * iOS 18+. Works with or without `onPoiPress`. Omit to disable.
   */
  applePoiDetailPresentation?: ApplePoiDetailPresentation;

  /** Custom map style as a JSON string. Apple MapKit applies a curated subset on iOS 16+. */
  customMapStyle?: string;

  /** Whether to cluster nearby markers. */
  clusteringEnabled?: boolean;

  /** Entering animation for marker clusters. */
  clusterEnteringAnimation?: OverlayEnteringAnimation;

  /**
   * What a cluster press does after `onClusterPress` fires. `'zoom'` (the
   * default) fits the camera to the cluster's markers; `'none'` keeps the
   * camera still, for apps that open a list or sheet for the cluster instead.
   */
  clusterPressBehavior?: ClusterPressBehavior;
   * How the cluster badge looks: its colors, border, or an image behind the count. Fields
   * left out keep the default badge's look.
   */
  clusterStyle?: ClusterStyle;
}

interface GoogleMapViewProps
  extends BaseMapViewProps<GooglePoiPressEvent>, PointsOfInterestProps {
  provider: 'google';

  /** Google Cloud Map ID for cloud-based Google Maps styling. */
  googleMapId?: string;

  /** Google Maps SDK has no native scale control. */
  showsScale?: never;

  /** Google Maps SDK has no native POI detail surface; POI taps stay event-only. */
  applePoiDetailPresentation?: never;

  /** Custom Google Maps style JSON. */
  customMapStyle?: string;

  /** Whether to cluster nearby markers. */
  clusteringEnabled?: boolean;

  /** Entering animation for marker clusters. */
  clusterEnteringAnimation?: OverlayEnteringAnimation;

  /**
   * What a cluster press does after `onClusterPress` fires. `'zoom'` (the
   * default) fits the camera to the cluster's markers; `'none'` keeps the
   * camera still, for apps that open a list or sheet for the cluster instead.
   */
  clusterPressBehavior?: ClusterPressBehavior;
   * How the cluster badge looks: its colors, border, or an image behind the count. Fields
   * left out keep the default badge's look.
   */
  clusterStyle?: ClusterStyle;
}

interface OpenStreetMapViewProps extends BaseMapViewProps {
  provider: 'openstreetmap';
  googleMapId?: never;
  showsScale?: never;
  applePoiDetailPresentation?: never;
  customMapStyle?: never;
  pointsOfInterest?: never;
  clusteringEnabled?: never;
  clusterEnteringAnimation?: never;
  clusterPressBehavior?: never;
  clusterStyle?: never;
  onPoiPress?: never;
}

interface MapboxMapViewProps extends BaseMapViewProps {
  provider: 'mapbox';
  googleMapId?: never;
  showsScale?: never;
  applePoiDetailPresentation?: never;
  customMapStyle?: never;
  pointsOfInterest?: never;
  clusteringEnabled?: never;
  clusterEnteringAnimation?: never;
  clusterPressBehavior?: never;
  clusterStyle?: never;
  onPoiPress?: never;
}

export type MapViewPropsForProvider<Provider extends MapProvider> =
  Provider extends 'apple'
    ? AppleMapViewProps
    : Provider extends 'google'
      ? GoogleMapViewProps
      : Provider extends 'openstreetmap'
        ? OpenStreetMapViewProps
        : Provider extends 'mapbox'
          ? MapboxMapViewProps
          : never;

/**
 * Props for the root map view component.
 */
export type MapViewProps =
  | ExistingDefaultProviderProps
  | AppleMapViewProps
  | GoogleMapViewProps
  | OpenStreetMapViewProps
  | MapboxMapViewProps;
