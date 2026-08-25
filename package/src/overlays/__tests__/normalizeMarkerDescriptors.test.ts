import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { MarkerDescriptor } from '../../native/specs/overlays';

const resolveAssetSourceMock = mock(
  (source: number | { uri: string; width?: number; height?: number; scale?: number }) => {
    if (typeof source === 'number') {
      return {
        uri: `asset:/require-${source}.png`,
        width: 32,
        height: 32,
        scale: 2,
      };
    }

    return source;
  },
);

mock.module('../assetSourceResolver', () => ({
  resolveAssetSource: resolveAssetSourceMock,
}));

const { clearResolvedMarkerImageCacheForTests } = await import('../resolveMarkerImage');
const { normalizeMarkerDescriptors } = await import('../normalizeMarkerDescriptors');

const baseDescriptor: MarkerDescriptor = {
  id: 'marker-1',
  coordinate: { latitude: 37.7749, longitude: -122.4194 },
  title: 'Test',
  markerColor: '#FF9500',
  zIndex: 3,
};

describe('normalizeMarkerDescriptors', () => {
  beforeEach(() => {
    resolveAssetSourceMock.mockClear();
    clearResolvedMarkerImageCacheForTests();
  });

  test('returns the same array reference when descriptors are unchanged', () => {
    const descriptors = [baseDescriptor];

    expect(normalizeMarkerDescriptors(descriptors)).toBe(descriptors);
  });

  test('returns the same array reference when images are already resolved MarkerImage objects', () => {
    const image = {
      uri: 'asset:/pin.png',
      width: 32,
      height: 32,
      scale: 2,
    };
    const descriptors = [{ ...baseDescriptor, image }];

    expect(normalizeMarkerDescriptors(descriptors)).toBe(descriptors);
  });

  test('returns a new array when a require() image is resolved', () => {
    const descriptors = [{ ...baseDescriptor, image: 42 as never }];
    const normalized = normalizeMarkerDescriptors(descriptors);

    expect(normalized).not.toBe(descriptors);
    expect(normalized[0]?.image).toEqual({
      uri: 'asset:/require-42.png',
      width: 32,
      height: 32,
      scale: 2,
    });
  });

  test('stabilizes after the first require() resolution', () => {
    const descriptors = [{ ...baseDescriptor, image: 7 as never }];
    const first = normalizeMarkerDescriptors(descriptors);
    const second = normalizeMarkerDescriptors(first);

    expect(second).toBe(first);
    expect(resolveAssetSourceMock).toHaveBeenCalledTimes(1);
  });
});
