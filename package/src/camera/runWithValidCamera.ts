import type { Camera } from '../types/camera';
import { isValidCamera } from './isValidCamera';

export const INVALID_CAMERA_ERROR =
  'Camera rejected: invalid center coordinate, or a zoom, heading, pitch or altitude the map cannot use';

/**
 * Runs a `setCamera` or `animateCamera` call, or rejects it when the map cannot
 * use the camera. The `camera` prop can only skip such a camera, but these
 * calls have a promise to report it on, and resolving one for a camera that
 * never moved the map is the silent no-op `MapViewRef` rules out.
 *
 * Checked before the call is queued, so it rejects straight away - also before
 * the native map exists - and the same way on every platform and provider. The
 * native guards behind it only skip.
 */
export function runWithValidCamera<Result>(
  camera: Camera,
  run: () => Promise<Result>,
): Promise<Result> {
  if (!isValidCamera(camera)) {
    return Promise.reject(new Error(INVALID_CAMERA_ERROR));
  }

  return run();
}
