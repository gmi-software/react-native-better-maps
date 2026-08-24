import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { MarkerDescriptor } from '../../native/specs/overlays';

const resolveAssetSourceMock = mock(
  (
    source:
      number | { uri: string; width?: number; height?: number; scale?: number },
  ) => {
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

const { clearResolvedMarkerImageCacheForTests } =
  await import('../resolveMarkerImage');
const { normalizeMarkerDescriptors } =
  await import('../normalizeMarkerDescriptors');

const baseDescriptor: MarkerDescriptor = {
  id: 'marker-1',
  coordinate: { latitude: 37.7749, longitude: -122.4194 },
  title: 'Test',
};

describe('normalizeMarkerDescriptors', () => {
  beforeEach(() => {
    resolveAssetSourceMock.mockClear();
    clearResolvedMarkerImageCacheForTests();
  });

  test('carries a descriptor without an image across unchanged', () => {
    expect(normalizeMarkerDescriptors([baseDescriptor])).toEqual([
      { ...baseDescriptor, image: undefined },
    ]);
  });

  test('resolves a require() image into a MarkerImage', () => {
    const normalized = normalizeMarkerDescriptors([
      { ...baseDescriptor, image: 42 as never },
    ]);

    expect(normalized[0]?.image).toEqual({
      uri: 'asset:/require-42.png',
      width: 32,
      height: 32,
      scale: 2,
    });
  });

  test('carries an already resolved MarkerImage across', () => {
    const image = { uri: 'asset:/pin.png', width: 32, height: 32, scale: 2 };

    expect(
      normalizeMarkerDescriptors([{ ...baseDescriptor, image }])[0]?.image,
    ).toEqual(image);
  });

  test('resolves each require() source only once', () => {
    const descriptors = [{ ...baseDescriptor, image: 7 as never }];
    normalizeMarkerDescriptors(descriptors);
    normalizeMarkerDescriptors(descriptors);

    expect(resolveAssetSourceMock).toHaveBeenCalledTimes(1);
  });

  test('normalizes a per-marker entering animation', () => {
    const normalized = normalizeMarkerDescriptors([
      { ...baseDescriptor, enteringAnimation: false },
    ]);

    expect(normalized[0]?.enteringAnimation).toEqual({ kind: 'none' });
  });
});
