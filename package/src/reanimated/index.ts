import { useMemo } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { Camera } from '../types/camera';
import { createCameraBinding } from './cameraBinding';

export interface CameraSharedValue {
  /** The latest camera the map reported; the initial value until the first move. */
  camera: SharedValue<Camera | null>;

  /** Pass this as `onCameraMove`. Stable for the life of the component. */
  onCameraMove: (camera: Camera) => void;
}

/**
 * Feeds `onCameraMove` updates into a Reanimated shared value, so overlays can
 * follow the camera on the UI thread without a React render per update.
 *
 * ```tsx
 * const { camera, onCameraMove } = useCameraSharedValue();
 * const compass = useAnimatedStyle(() => ({
 *   transform: [{ rotate: `${-(camera.value?.heading ?? 0)}deg` }],
 * }));
 *
 * <MapView onCameraMove={onCameraMove} cameraMoveThrottleMs={16} />
 * <Animated.View style={[styles.compass, compass]} />
 * ```
 *
 * Available from `react-native-better-maps/reanimated`; `react-native-reanimated`
 * is an optional peer dependency of the package.
 */
export function useCameraSharedValue(
  initial: Camera | null = null,
): CameraSharedValue {
  const camera = useSharedValue<Camera | null>(initial);
  return useMemo(
    () => ({ camera, onCameraMove: createCameraBinding(camera) }),
    [camera],
  );
}
