import type { Camera } from './camera';
import type { Coordinate } from './coordinate';
import type { EdgePadding, VisibleRegion } from './region';

/**
 * Imperative handle for controlling the map view.
 */
export interface MapViewRef {
  /** Returns the current camera position. */
  getCamera(): Promise<Camera>;

  /** Sets the camera position immediately. */
  setCamera(camera: Camera): Promise<void>;

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
}
