import type { Camera } from '../types/camera';
import { isValidCamera } from './isValidCamera';
import { warnCamera } from './warnCamera';

// Once the view has accepted a camera the prop must never go back to
// `undefined`, whether it was unset or is unusable - the invariant
// `resolveRegionProp` documents: React rewrites a removed prop to `null`, the
// optional JSI converter only short-circuits on `undefined`, and the generated
// struct converter then calls `asObject` on a null and throws, before any
// native guard runs. Holding the last accepted camera leaves the prop
// untouched instead, which is also what the map should show. Before anything
// has been accepted there is nothing to hold, and `undefined` at mount is
// safe: React omits the key entirely.
export function resolveCameraProp(
  camera: Camera | undefined,
  lastAccepted: Camera | undefined,
): Camera | undefined {
  if (camera == null) {
    return lastAccepted;
  }

  if (isValidCamera(camera)) {
    return camera;
  }

  warnCamera(
    'camera ignored: invalid center coordinate, or a zoom, heading, pitch or altitude the map cannot use',
  );

  return lastAccepted;
}
