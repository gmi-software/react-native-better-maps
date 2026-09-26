import type { Camera } from './camera';
import type { Coordinate } from './coordinate';
import type { EdgePadding, Region, VisibleRegion } from './region';

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
 *   mapRef.current
 *     ?.fitToCoordinates(points)
 *     .catch((error: Error) => console.warn(error.message));
 * }, []);
 * ```
 */
export interface MapViewRef {
  /** Returns the current camera position. */
  getCamera(): Promise<Camera>;

  /**
   * Sets the camera position immediately.
   *
   * Rejects straight away, and leaves the map where it is, for a camera the
   * map cannot use: a center outside the world, or a zoom, heading, pitch or
   * altitude that is `NaN`, infinite, or - for zoom and heading - too large for
   * a 32-bit float. The `camera` prop skips such a camera instead.
   */
  setCamera(camera: Camera): Promise<void>;

  /**
   * Animates the camera to the given position. Resolves once the animation has
   * been handed to the native map, not when it finishes, and rejects for a
   * camera the map cannot use, as {@linkcode MapViewRef.setCamera} does.
   *
   * @param duration Animation duration in milliseconds. Defaults to `250`;
   * `0` moves the camera without animating.
   */
  animateCamera(camera: Camera, duration?: number): Promise<void>;

  /**
   * Animates the camera to frame the given region as the `region` prop does:
   * all of it in view, north up and flat. A region from
   * {@linkcode MapViewProps.onRegionChangeComplete} passed back returns the map
   * to that view.
   *
   * Resolves once the animation has been handed to the native map, not when
   * it finishes, and rejects for a region the map cannot use - a center
   * outside the world, or a delta that is not a finite number greater than 0 -
   * which the `region` prop skips instead.
   *
   * @param duration Animation duration in milliseconds. Defaults to `250`;
   * `0` moves the camera without animating.
   */
  animateToRegion(region: Region, duration?: number): Promise<void>;

  /** Returns the currently visible geographic region. */
  getVisibleRegion(): Promise<VisibleRegion>;

  /**
   * Fits the camera to show all given coordinates with optional edge padding.
   * An empty {@linkcode coordinates} list is a no-op.
   *
   * {@linkcode padding} is added on top of {@linkcode MapViewProps.mapPadding}.
   *
   * @param animated Pass it explicitly: omitted, iOS animates and Android jumps.
   */
  fitToCoordinates(
    coordinates: Coordinate[],
    padding?: EdgePadding,
    animated?: boolean,
  ): Promise<void>;
}
