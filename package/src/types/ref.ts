import type { Camera } from './camera';
import type { Coordinate } from './coordinate';
import type { Point } from './point';
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

  /**
   * Returns where the map draws {@linkcode coordinate} under the current
   * camera, in density-independent pixels from the top-left corner of the map
   * view. That is the unit and origin of the map view's own layout, so the
   * point can position a React Native element over the map as it is.
   *
   * A coordinate that is off screen gives a point outside the map view's
   * bounds. The point goes stale once the camera moves. On Android the Google
   * Maps SDK works in whole device pixels, so the point is accurate to a
   * fraction of a density-independent pixel.
   *
   * Rejects straight away for a coordinate outside the world: a latitude or
   * longitude that is `NaN`, infinite, or beyond ±90 / ±180.
   */
  pointForCoordinate(coordinate: Coordinate): Promise<Point>;

  /**
   * Returns the coordinate the map draws at {@linkcode point} under the current
   * camera - the reverse of {@linkcode MapViewRef.pointForCoordinate}, in the
   * same density-independent pixels from the top-left corner of the map view.
   *
   * Rejects straight away for a point whose `x` or `y` is `NaN` or infinite,
   * and rejects when the map reports no ground under the point.
   */
  coordinateForPoint(point: Point): Promise<Coordinate>;
}
