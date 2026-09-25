import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  isMarkerImage,
  markerImageFromResolvedAsset,
} from '../markerImageFromResolvedAsset';

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

const { clearResolvedMarkerImageCacheForTests, resolveMarkerImage } = await import(
  '../resolveMarkerImage'
);

describe('markerImageFromResolvedAsset', () => {
  test('returns undefined for missing asset', () => {
    expect(markerImageFromResolvedAsset(undefined)).toBeUndefined();
    expect(markerImageFromResolvedAsset(null)).toBeUndefined();
    expect(markerImageFromResolvedAsset({ uri: '' })).toBeUndefined();
  });

  test('maps resolved asset records to MarkerImage', () => {
    expect(
      markerImageFromResolvedAsset({
        uri: 'asset:/pin.png',
        width: 32,
        height: 32,
        scale: 2,
      }),
    ).toEqual({
      uri: 'asset:/pin.png',
      width: 32,
      height: 32,
      scale: 2,
    });
  });

  test('leaves out null dimensions', () => {
    // React Native types resolved asset dimensions `?number`.
    const resolved = {
      uri: 'asset:/pin.png',
      width: null,
      height: null,
      scale: 2,
    };

    expect(markerImageFromResolvedAsset(resolved as never)).toEqual({
      uri: 'asset:/pin.png',
      scale: 2,
    });
    expect(isMarkerImage(resolved)).toBe(true);
  });

  test('detects MarkerImage objects', () => {
    expect(isMarkerImage({ uri: 'https://example.com/pin.png' })).toBe(true);
    expect(
      isMarkerImage({
        uri: 'asset:/pin.png',
        width: 32,
        height: 32,
        scale: 2,
      }),
    ).toBe(true);
    expect(isMarkerImage({ url: 'nope' })).toBe(false);
    expect(isMarkerImage({ uri: 'https://example.com/pin.png', width: 'bad' })).toBe(
      false,
    );
    expect(isMarkerImage(null)).toBe(false);
    expect(isMarkerImage({ uri: '' })).toBe(false);
  });
});

describe('resolveMarkerImage', () => {
  beforeEach(() => {
    resolveAssetSourceMock.mockClear();
    clearResolvedMarkerImageCacheForTests();
  });

  test('returns undefined for nullish sources', () => {
    expect(resolveMarkerImage(undefined)).toBeUndefined();
    expect(resolveMarkerImage(null as never)).toBeUndefined();
  });

  test('resolves require() module ids through resolveAssetSource', () => {
    expect(resolveMarkerImage(99)).toEqual({
      uri: 'asset:/require-99.png',
      width: 32,
      height: 32,
      scale: 2,
    });
    expect(resolveAssetSourceMock).toHaveBeenCalledTimes(1);
    expect(resolveAssetSourceMock).toHaveBeenCalledWith(99);
  });

  test('passes through uri-only sources as MarkerImage without resolveAssetSource', () => {
    const source = { uri: 'https://example.com/pin.png' };

    expect(resolveMarkerImage(source)).toEqual({
      uri: 'https://example.com/pin.png',
    });
    expect(resolveAssetSourceMock).not.toHaveBeenCalled();
  });

  test('passes through MarkerImage objects unchanged', () => {
    const image = {
      uri: 'asset:/pin.png',
      width: 32,
      height: 32,
      scale: 2,
    };

    expect(resolveMarkerImage(image)).toBe(image);
    expect(resolveAssetSourceMock).not.toHaveBeenCalled();
  });

  test('caches require() resolutions by module id', () => {
    const first = resolveMarkerImage(5);
    const second = resolveMarkerImage(5);

    expect(first).toBe(second);
    expect(resolveAssetSourceMock).toHaveBeenCalledTimes(1);
  });

  test('caches MarkerImage objects by cache key', () => {
    const image = { uri: 'asset:/pin.png', width: 32, height: 32, scale: 2 };
    const first = resolveMarkerImage(image);
    const second = resolveMarkerImage({ ...image });

    expect(first).toBe(second);
    expect(resolveAssetSourceMock).not.toHaveBeenCalled();
  });

  test('reuses cached MarkerImage after uri object resolution', () => {
    const source = {
      uri: 'asset:/remote.png',
      width: 24,
      height: 24,
      scale: 3,
    };
    const resolved = resolveMarkerImage(source);
    const cached = resolveMarkerImage({
      uri: resolved!.uri,
      width: resolved!.width,
      height: resolved!.height,
      scale: resolved!.scale,
    });

    expect(cached).toBe(resolved);
    expect(resolveAssetSourceMock).not.toHaveBeenCalled();
  });
});
