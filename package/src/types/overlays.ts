import type {
  MarkerAnchor,
  MarkerImage,
  MarkerImageSource,
  MarkerPoint,
} from '../native/specs/overlays';
import type { Coordinate } from './coordinate';

export type { MarkerAnchor, MarkerImage, MarkerImageSource, MarkerPoint };

export type OverlayEnteringAnimationPreset = 'fade' | 'fade-scale';

export type OverlayEnteringAnimationReduceMotion = 'system' | 'never';

export interface OverlayEnteringAnimationConfig {
  /** Cross-provider entering animation preset. */
  preset: OverlayEnteringAnimationPreset;

  /** Animation duration in milliseconds. */
  duration?: number;

  /** Delay before starting the animation, in milliseconds. */
  delay?: number;

  /** Whether system Reduced Motion settings should disable the animation. */
  reduceMotion?: OverlayEnteringAnimationReduceMotion;
}

export type OverlayEnteringAnimation =
  | false
  | 'system'
  | OverlayEnteringAnimationConfig;

/**
 * Descriptor for bulk marker rendering.
 */
export interface MarkerDescriptor {
  /** Unique identifier for the marker. */
  id: string;

  /** Geographic position of the marker. */
  coordinate: Coordinate;

  /** Title displayed in the callout. */
  title?: string;

  /** Subtitle displayed in the callout. */
  subtitle?: string;

  /** Whether the marker is draggable. */
  draggable?: boolean;

  /** Whether the marker participates in clustering when enabled on the map. */
  clusterable?: boolean;

  /** Custom marker image. */
  image?: MarkerImageSource;

  /** Color applied to the default marker when no custom image is set. */
  markerColor?: string;

  /** Anchor point on the image relative to the coordinate (default bottom-center). */
  anchor?: MarkerAnchor;

  /** Additional center offset in dp (iOS-style). */
  centerOffset?: MarkerPoint;

  /** Clockwise rotation in degrees. */
  rotation?: number;

  /** When true, rotate with the map plane instead of staying screen-aligned. */
  flat?: boolean;

  /** Opacity from 0 to 1. */
  opacity?: number;

  /** Drawing order relative to other map overlays. */
  zIndex?: number;

  /** Entering animation override for this marker. */
  enteringAnimation?: OverlayEnteringAnimation;
}

/**
 * Props for a map marker overlay.
 */
export interface MarkerProps {
  /**
   * Public overlay id returned by `onMarkerPress` / `onClusterPress`.
   * Wins over the React `key`. When omitted, the collector uses
   * `marker-key-${key}`, then positional `marker-N`.
   */
  id?: string;

  /** Geographic position of the marker. Invalid coordinates skip the marker with a development warning. */
  coordinate: Coordinate;

  /** Title displayed in the callout. */
  title?: string;

  /** Subtitle displayed in the callout. */
  subtitle?: string;

  /** Whether the marker is draggable. */
  draggable?: boolean;

  /** Whether the marker participates in clustering when enabled on the map. */
  clusterable?: boolean;

  /** Custom marker image. */
  image?: MarkerImageSource;

  /** Color applied to the default marker when no custom image is set. */
  markerColor?: string;

  /** Drawing order relative to other map overlays. */
  zIndex?: number;

  /** Anchor point on the image relative to the coordinate (default bottom-center). */
  anchor?: MarkerAnchor;

  /** Additional center offset in dp (iOS-style). */
  centerOffset?: MarkerPoint;

  /** Clockwise rotation in degrees. */
  rotation?: number;

  /** When true, rotate with the map plane instead of staying screen-aligned. */
  flat?: boolean;

  /** Opacity from 0 to 1. */
  opacity?: number;

  /** Entering animation override for this marker. */
  enteringAnimation?: OverlayEnteringAnimation;

  /** Called when the marker is pressed. */
  onPress?: () => void;

  /** Called when the marker drag ends. */
  onDragEnd?: (coordinate: Coordinate) => void;
}

/**
 * Props for a polyline overlay.
 */
export interface PolylineProps {
  /**
   * Public overlay id returned by `onPolylinePress`.
   * Wins over the React `key`. When omitted, the collector uses
   * `polyline-key-${key}`, then positional `polyline-N`.
   */
  id?: string;

  /** Ordered list of coordinates forming the polyline. Invalid coordinates or fewer than 2 points skip the polyline with a development warning. */
  coordinates: Coordinate[];

  /** Stroke color in hex format (e.g. '#FF0000'). */
  strokeColor?: string;

  /** Stroke width in density-independent pixels. */
  strokeWidth?: number;

  /** Whether the polyline is tappable. */
  tappable?: boolean;

  /** Called when the polyline is pressed. */
  onPress?: () => void;
}

/**
 * Props for a polygon overlay.
 */
export interface PolygonProps {
  /**
   * Public overlay id returned by `onPolygonPress`.
   * Wins over the React `key`. When omitted, the collector uses
   * `polygon-key-${key}`, then positional `polygon-N`.
   */
  id?: string;

  /** Ordered list of coordinates forming the polygon boundary. Invalid coordinates or fewer than 3 points skip the polygon with a development warning. */
  coordinates: Coordinate[];

  /** Fill color in hex format (e.g. '#FF000080'). */
  fillColor?: string;

  /** Stroke color in hex format. */
  strokeColor?: string;

  /** Stroke width in density-independent pixels. */
  strokeWidth?: number;

  /** Whether the polygon is tappable. */
  tappable?: boolean;

  /** Called when the polygon is pressed. */
  onPress?: () => void;
}

/**
 * Props for a circle overlay.
 */
export interface CircleProps {
  /**
   * Public overlay id returned by `onCirclePress`.
   * Wins over the React `key`. When omitted, the collector uses
   * `circle-key-${key}`, then positional `circle-N`.
   */
  id?: string;

  /** Center coordinate of the circle. An invalid center skips the circle with a development warning. */
  center: Coordinate;

  /** Radius in meters. A non-finite or negative radius skips the circle with a development warning. */
  radius: number;

  /** Fill color in hex format. */
  fillColor?: string;

  /** Stroke color in hex format. */
  strokeColor?: string;

  /** Stroke width in density-independent pixels. */
  strokeWidth?: number;

  /** Whether the circle is tappable. */
  tappable?: boolean;

  /** Called when the circle is pressed. */
  onPress?: () => void;
}
