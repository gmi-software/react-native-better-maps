import { useValidCamera } from '../camera/useValidCamera';
import { useValidRegion } from '../region/useValidRegion';
import type { MapViewProps } from '../types/map';
import {
  camerasEqual,
  edgePaddingsEqual,
  regionsEqual,
} from '../utils/mapValueEquality';
import { useStableValue } from './useStableValue';

/**
 * The `region`, `camera` and `mapPadding` to hand to the native view:
 * validated, and kept as the previous object for as long as they stay
 * structurally equal.
 *
 * All three are usually written inline in JSX, so an equal-but-new object
 * would otherwise reach native on every render, and every provider answers a
 * re-sent `region` or `camera` by moving the map back to it - snapping it back
 * after a pan. The comparison runs on what validation accepted, because an
 * invalid camera may not even have a `center`.
 */
export function useStableCameraProps({
  region,
  camera,
  mapPadding,
}: Pick<MapViewProps, 'region' | 'camera' | 'mapPadding'>) {
  const validRegion = useStableValue(useValidRegion(region), regionsEqual);
  const validCamera = useStableValue(useValidCamera(camera), camerasEqual);
  const stableMapPadding = useStableValue(mapPadding, edgePaddingsEqual);

  return {
    region: validRegion,
    camera: validCamera,
    mapPadding: stableMapPadding,
  };
}
