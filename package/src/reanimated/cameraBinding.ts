import type { Camera } from '../types/camera';

/** The part of a Reanimated shared value the binding writes to. */
export interface WritableSharedValue<Value> {
  value: Value;
}

/**
 * Returns an `onCameraMove` handler that stores every camera the map reports
 * in `target`. Kept apart from the hook so it can be tested without a
 * Reanimated runtime.
 */
export function createCameraBinding(
  target: WritableSharedValue<Camera | null>,
): (camera: Camera) => void {
  return (camera) => {
    target.value = camera;
  };
}
