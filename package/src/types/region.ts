import type { Coordinate } from './coordinate';

/**
 * A rectangular region defined by its center and span.
 */
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Padding applied to map edges, in density-independent pixels.
 */
export interface EdgePadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The geographic bounds of the currently visible map area.
 */
export interface VisibleRegion {
  nearLeft: Coordinate;
  nearRight: Coordinate;
  farLeft: Coordinate;
  farRight: Coordinate;
}

/**
 * Context delivered alongside a region change.
 */
export interface RegionChangeDetails {
  /** Whether the change was started by a user gesture rather than by the app. */
  isGesture: boolean;
}
