import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import type { MarkerDescriptor } from '../../types/overlays';

const warnSpy = spyOn(console, 'warn');
const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;

function restoreDevFlag(): void {
  const globalDev = globalThis as { __DEV__?: boolean };
  if (previousDev === undefined) {
    delete globalDev.__DEV__;
    return;
  }

  globalDev.__DEV__ = previousDev;
}

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

const baseDescriptor = {
  id: 'marker-1',
  coordinate: { latitude: 37.7749, longitude: -122.4194 },
  title: 'Test',
  markerColor: '#FF9500',
  zIndex: 3,
} satisfies MarkerDescriptor;

function withCoordinate(
  id: string,
  latitude: number,
  longitude: number,
): MarkerDescriptor {
  return { ...baseDescriptor, id, coordinate: { latitude, longitude } };
}

describe('normalizeMarkerDescriptors', () => {
  beforeEach(() => {
    resolveAssetSourceMock.mockClear();
    clearResolvedMarkerImageCacheForTests();
    warnSpy.mockClear();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  });

  afterEach(() => {
    warnSpy.mockClear();
    restoreDevFlag();
  });

  test('skips a descriptor whose coordinate cannot be placed and keeps its neighbours in order', () => {
    const normalized = normalizeMarkerDescriptors([
      withCoordinate('first', 52.23, 21.01),
      withCoordinate('nan', Number.NaN, 21.01),
      withCoordinate('infinite', 52.23, Number.POSITIVE_INFINITY),
      withCoordinate('out-of-range', 1000, 0),
      withCoordinate('last', 50.06, 19.94),
    ]);

    expect(normalized.map((descriptor) => descriptor.id)).toEqual([
      'first',
      'last',
    ]);
  });

  test('warns once per skipped descriptor, naming its id', () => {
    normalizeMarkerDescriptors([
      withCoordinate('bad-1', Number.NaN, Number.NaN),
      withCoordinate('good', 52.23, 21.01),
      withCoordinate('bad-2', Number.POSITIVE_INFINITY, 0),
    ]);

    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      'marker "bad-1" skipped: invalid coordinate',
    );
    expect(warnSpy.mock.calls[1]?.[0]).toContain(
      'marker "bad-2" skipped: invalid coordinate',
    );
  });

  test('skips a descriptor that has no coordinate at all', () => {
    const normalized = normalizeMarkerDescriptors([
      { ...baseDescriptor, id: 'undefined', coordinate: undefined as never },
      { ...baseDescriptor, id: 'null', coordinate: null as never },
    ]);

    expect(normalized).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(2);
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
