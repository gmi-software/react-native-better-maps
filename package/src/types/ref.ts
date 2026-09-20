import type { Camera } from './camera';
import type { Coordinate } from './coordinate';
import type { EdgePadding, VisibleRegion } from './region';

/**
 * Imperative handle for controlling the map view.
 *
 * Every method is usable as soon as React has attached the ref. A call made
 * before the native map exists - from a mount effect, for example - is held and
 * replayed once it does, in the order the calls were made, so waiting for
 * {@linkcode MapViewProps.onMapReady} or a timer is never necessary.
 *
 * A call that is still waiting when the map view unmounts rejects, as does any
 * call made afterwards. Nothing silently does nothing.
 *
 * @example
 * ```tsx
 * const mapRef = useRef<MapViewRef>(null);
 *
 * useEffect(() => {
 *   mapRef.current?.fitToCoordinates(points);
 * }, []);
 * ```
 */
export interface MapViewRef {
  /** Returns the current camera position. */
  getCamera(): Promise<Camera>;

  /** Sets the camera position immediately. */
  setCamera(camera: Camera): Promise<void>;

  /**
   * Animates the camera to the given position. Resolves once the animation has
   * been handed to the native map, not when it finishes.
   *
   * @param duration Animation duration in seconds. Defaults to `0.25`.
   */
  animateCamera(camera: Camera, duration?: number): Promise<void>;

  /** Returns the currently visible geographic region. */
  getVisibleRegion(): Promise<VisibleRegion>;

  /**
   * Fits the camera to show all given coordinates with optional edge padding.
   * An empty {@linkcode coordinates} list is a no-op.
   *
   * @param animated Pass it explicitly: omitted, iOS animates and Android jumps.
   */
  fitToCoordinates(
    coordinates: Coordinate[],
    padding?: EdgePadding,
    animated?: boolean,
  ): Promise<void>;
}
