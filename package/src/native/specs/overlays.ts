import type { Coordinate } from '../../types/coordinate';

export interface MarkerImage {
  uri: string;
  width?: number;
  height?: number;
  scale?: number;
}

export type MarkerImageSource = number | MarkerImage;

/** Anchor point on the marker image (0..1). */
export interface MarkerAnchor {
  x: number;
  y: number;
}

/** Point offset in density-independent pixels. */
export interface MarkerPoint {
  x: number;
  y: number;
}

export type OverlayEnteringAnimationKind =
  | 'none'
  | 'system'
  | 'fade'
  | 'fade-scale';

export type OverlayEnteringAnimationReduceMotion = 'system' | 'never';

/**
 * Serialized entering animation config passed to native map providers.
 */
export interface OverlayEnteringAnimationDescriptor {
  /** Resolved animation kind. */
  kind: OverlayEnteringAnimationKind;

  /** Animation duration in milliseconds. */
  duration?: number;

  /** Delay before starting the animation, in milliseconds. */
  delay?: number;

  /** Whether system Reduced Motion settings should disable the animation. */
  reduceMotion?: OverlayEnteringAnimationReduceMotion;
}

/**
 * Serialized marker overlay passed to the native map view.
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
  image?: MarkerImage;

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
  enteringAnimation?: OverlayEnteringAnimationDescriptor;
}

/**
 * Serialized polyline overlay passed to the native map view.
 */
export interface PolylineDescriptor {
  /** Unique identifier for the polyline. */
  id: string;

  /** Ordered list of coordinates forming the polyline. */
  coordinates: Coordinate[];

  /** Stroke color in hex format (e.g. '#FF0000'). */
  strokeColor?: string;

  /** Stroke width in density-independent pixels. */
  strokeWidth?: number;

  /** Whether the polyline is tappable. */
  tappable?: boolean;
}

/**
 * Serialized polygon overlay passed to the native map view.
 */
export interface PolygonDescriptor {
  /** Unique identifier for the polygon. */
  id: string;

  /** Ordered list of coordinates forming the polygon exterior boundary. */
  coordinates: Coordinate[];

  /** Interior polygon boundaries that remain unfilled. */
  holes?: Coordinate[][];

  /** Fill color in hex format (e.g. '#FF000080'). */
  fillColor?: string;

  /** Stroke color in hex format. */
  strokeColor?: string;

  /** Stroke width in density-independent pixels. */
  strokeWidth?: number;

  /** Whether the polygon is tappable. */
  tappable?: boolean;
}

/**
 * Serialized circle overlay passed to the native map view.
 */
export interface CircleDescriptor {
  /** Unique identifier for the circle. */
  id: string;

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
}
