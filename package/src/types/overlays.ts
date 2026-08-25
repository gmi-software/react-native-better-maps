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
  /** Unique identifier for the marker. */
  id?: string;

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
  /** Unique identifier for the polyline. */
  id?: string;

  /** Ordered list of coordinates forming the polyline. */
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
  /** Unique identifier for the polygon. */
  id?: string;

  /** Ordered list of coordinates forming the polygon boundary. */
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
  /** Unique identifier for the circle. */
  id?: string;

  /** Center coordinate of the circle. */
  center: Coordinate;

  /** Radius in meters. */
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
