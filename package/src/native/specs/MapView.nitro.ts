import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';
import type { Camera } from '../../types/camera';
import type { Coordinate } from '../../types/coordinate';
import type { MapProvider, MapType } from '../../types/map';
import type { EdgePadding, Region, VisibleRegion } from '../../types/region';
import type { MarkerCollection } from './MarkerCollection.nitro';
import type {
  CircleDescriptor,
  OverlayEnteringAnimationDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from './overlays';

export type ApplePoiCategory =
  | 'animalService'
  | 'airport'
  | 'amusementPark'
  | 'aquarium'
  | 'atm'
  | 'automotiveRepair'
  | 'bakery'
  | 'bank'
  | 'baseball'
  | 'basketball'
  | 'beach'
  | 'beauty'
  | 'bowling'
  | 'brewery'
  | 'cafe'
  | 'campground'
  | 'carRental'
  | 'castle'
  | 'conventionCenter'
  | 'distillery'
  | 'evCharger'
  | 'fairground'
  | 'fireStation'
  | 'fishing'
  | 'fitnessCenter'
  | 'foodMarket'
  | 'fortress'
  | 'gasStation'
  | 'golf'
  | 'goKart'
  | 'hiking'
  | 'hospital'
  | 'hotel'
  | 'kayaking'
  | 'landmark'
  | 'laundry'
  | 'library'
  | 'mailbox'
  | 'marina'
  | 'miniGolf'
  | 'movieTheater'
  | 'museum'
  | 'musicVenue'
  | 'nationalMonument'
  | 'nationalPark'
  | 'nightlife'
  | 'park'
  | 'parking'
  | 'pharmacy'
  | 'planetarium'
  | 'playground'
  | 'police'
  | 'postOffice'
  | 'publicTransport'
  | 'religiousSite'
  | 'restaurant'
  | 'restroom'
  | 'rockClimbing'
  | 'rvPark'
  | 'school'
  | 'skatePark'
  | 'skating'
  | 'skiing'
  | 'soccer'
  | 'spa'
  | 'stadium'
  | 'store'
  | 'surfing'
  | 'swimming'
  | 'tennis'
  | 'theater'
  | 'university'
  | 'volleyball'
  | 'winery'
  | 'zoo'
  | 'unknown';

/**
 * How Apple MapKit draws markers that have no image. `flat` is one pre-rendered
 * image per pin, `system` is `MKMarkerAnnotationView` with its balloon and
 * selection animation.
 */
export type MarkerPinStyle = 'flat' | 'system';

export interface NativePoiPressEvent {
  provider: MapProvider;
  coordinate: Coordinate;
  name?: string;
  category?: ApplePoiCategory;
  rawCategory?: string;
  placeId?: string;
}

/**
 * Payload of a marker-cluster press. Member ids are fetched on demand through
 * `getClusterMembers` so a press on a 100k-marker cluster does not ship
 * every id across JSI.
 */
export interface NativeClusterPressEvent {
  /** Identity of the pressed cluster while it is displayed. */
  clusterId: string;

  /** Number of markers in the cluster. */
  count: number;

  /** Position of the cluster badge. */
  coordinate: Coordinate;
}

/**
 * Native props for the {@linkcode MapView} Nitro HybridView.
 *
 * @see {@linkcode MapView}
 */
export interface MapViewProps extends HybridViewProps {
  /** Native rendering backend for the map view. */
  provider?: MapProvider;

  /** Google Cloud Map ID for cloud-based Google Maps styling. */
  googleMapId?: string;

  /**
   * The visual style of the map.
   *
   * @see {@linkcode MapType}
   */
  mapType: MapType;

  /** Initial or controlled region. */
  region?: Region;

  /** Initial or controlled camera position. */
  camera?: Camera;

  /** Whether the user can scroll/pan the map. */
  scrollEnabled?: boolean;

  /** Whether the user can zoom the map. */
  zoomEnabled?: boolean;

  /** Whether the user can rotate the map. */
  rotateEnabled?: boolean;

  /** Whether the user can tilt/pitch the map. */
  pitchEnabled?: boolean;

  /** Whether to show the user's current location on the map. */
  showsUserLocation?: boolean;

  /** Whether the map camera should follow the user's location. */
  followsUserLocation?: boolean;

  /** Whether to show the compass control. */
  showsCompass?: boolean;

  /** Whether to show the scale control (iOS only). */
  showsScale?: boolean;

  /** Custom map style as a JSON string (full support on Android; curated subset on iOS 16+). */
  customMapStyle?: string;

  /** Whether to cluster nearby markers. */
  clusteringEnabled?: boolean;

  /** Padding applied to map edges, in density-independent pixels. */
  mapPadding?: EdgePadding;

  /** Default entering animation for marker overlays. */
  markerEnteringAnimation?: OverlayEnteringAnimationDescriptor;

  /** Entering animation for marker clusters. */
  clusterEnteringAnimation?: OverlayEnteringAnimationDescriptor;

  /** Apple MapKit pin rendering for markers without an image. */
  pinStyle?: MarkerPinStyle;

  /** Called once when a user-initiated region change begins. */
  onRegionChange?: (region: Region) => void;

  /** Called once when a user-initiated region change ends. */
  onRegionChangeComplete?: (region: Region) => void;

  /** Called when the map is ready to use. */
  onMapReady?: () => void;

  /** Called when the user presses the map. */
  onPress?: (coordinate: Coordinate) => void;

  /** Called when the user presses a provider-owned point of interest. */
  onPoiPress?: (event: NativePoiPressEvent) => void;

  /** Called when the user long-presses the map. */
  onLongPress?: (coordinate: Coordinate) => void;

  /** Native marker store rendered by this map. */
  markerCollection?: MarkerCollection;

  /** Polyline overlays to render on the map. */
  polylines?: PolylineDescriptor[];

  /** Polygon overlays to render on the map. */
  polygons?: PolygonDescriptor[];

  /** Circle overlays to render on the map. */
  circles?: CircleDescriptor[];

  /** Called when a marker is pressed. */
  onMarkerPress?: (id: string) => void;

  /** Called when a marker drag ends. */
  onMarkerDragEnd?: (id: string, coordinate: Coordinate) => void;

  /** Called when a polyline is pressed. */
  onPolylinePress?: (id: string) => void;

  /** Called when a polygon is pressed. */
  onPolygonPress?: (id: string) => void;

  /** Called when a circle is pressed. */
  onCirclePress?: (id: string) => void;

  /** Called when a marker cluster is pressed. */
  onClusterPress?: (event: NativeClusterPressEvent) => void;
}

/**
 * Imperative native methods for the {@linkcode MapView} Nitro HybridView,
 * callable through `hybridRef`.
 *
 * @see {@linkcode MapView}
 */
export interface MapViewMethods extends HybridViewMethods {
  /**
   * Returns the current camera position.
   *
   * Named `fetchCamera` in the Nitro spec to avoid colliding with the `camera`
   * prop accessor (`getCamera`/`setCamera`) in generated C++ bindings.
   */
  fetchCamera(): Promise<Camera>;

  /**
   * Sets the camera position immediately.
   *
   * Named `applyCamera` in the Nitro spec to avoid colliding with the `camera`
   * prop accessor (`getCamera`/`setCamera`) in generated C++ bindings.
   */
  applyCamera(camera: Camera): Promise<void>;

  /** Animates the camera to the given position. */
  animateCamera(camera: Camera, duration?: number): Promise<void>;

  /** Returns the currently visible geographic region. */
  getVisibleRegion(): Promise<VisibleRegion>;

  /** Fits the camera to show all given coordinates with optional edge padding. */
  fitToCoordinates(
    coordinates: Coordinate[],
    padding?: EdgePadding,
    animated?: boolean,
  ): Promise<void>;

  /**
   * Returns the ids of the markers inside a displayed cluster. Resolves to an
   * empty array when the cluster is no longer displayed.
   */
  getClusterMembers(clusterId: string): Promise<string[]>;
}

/**
 * Nitro HybridView for the native map.
 *
 * Backed by `HybridMapView` in Swift (iOS) and Kotlin (Android), and bridged
 * to React via `getHostComponent`.
 *
 * @see {@linkcode MapViewProps}
 * @see {@linkcode MapViewMethods}
 */
export type MapView = HybridView<MapViewProps, MapViewMethods>;
