import { describe, expect, test } from 'bun:test';
import type { Camera } from '../../types/camera';
import {
  createCameraBinding,
  type WritableSharedValue,
} from '../cameraBinding';

describe('createCameraBinding', () => {
  test('writes each camera into the shared value', () => {
    const target: WritableSharedValue<Camera | null> = { value: null };
    const onCameraMove = createCameraBinding(target);
    const first: Camera = {
      center: { latitude: 52.2, longitude: 21.0 },
      zoom: 12,
      heading: 45,
    };
    const second: Camera = { ...first, heading: 90 };

    onCameraMove(first);
    expect(target.value).toBe(first);
    onCameraMove(second);
    expect(target.value).toBe(second);
  });
});
