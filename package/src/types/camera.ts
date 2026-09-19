import type { Coordinate } from './coordinate';

/**
 * Camera position and orientation for the map view.
 */
export interface Camera {
  center: Coordinate;
  /**
   * Zoom level. The Google providers use this field and ignore `altitude`.
   * Apple MapKit may derive zoom from altitude.
   */
  zoom?: number;
  heading?: number;
  pitch?: number;
  /**
   * Apple MapKit only. The Google providers use `zoom` and ignore this field.
   */
  altitude?: number;
}
