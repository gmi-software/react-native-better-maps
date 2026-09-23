import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import {
  isMarkerImage,
  markerImageFromResolvedAsset,
} from '../markerImageFromResolvedAsset';

const resolveAssetSourceMock = mock(
  (source: number | { uri: string; width?: number; height?: number; scale?: number }) => {
    if (typeof source === 'number') {
      // A development build: Metro serves the asset from the packager, not as a drawable.
      return {
        uri: `http://10.0.2.2:8081/assets/require-${source}.png`,
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

const warnSpy = spyOn(console, 'warn');

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  warnSpy.mockClear();
});

describe('markerImageFromResolvedAsset', () => {
  test('returns undefined for missing asset', () => {
    expect(markerImageFromResolvedAsset(undefined)).toBeUndefined();
    expect(markerImageFromResolvedAsset(null)).toBeUndefined();
    expect(markerImageFromResolvedAsset({ uri: '' })).toBeUndefined();
  });

  test('maps resolved asset records to MarkerImage stamped as bundled', () => {
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
      origin: 'bundled',
    });
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
      uri: 'http://10.0.2.2:8081/assets/require-99.png',
      width: 32,
      height: 32,
      scale: 2,
      origin: 'bundled',
    });
    expect(resolveAssetSourceMock).toHaveBeenCalledTimes(1);
    expect(resolveAssetSourceMock).toHaveBeenCalledWith(99);
  });

  test('passes through uri-only sources as MarkerImage without resolveAssetSource', () => {
    const source = { uri: 'https://example.com/pin.png' };
    const resolved = resolveMarkerImage(source);

    expect(resolved).toEqual({
      uri: 'https://example.com/pin.png',
    });
    expect(resolved?.origin).toBeUndefined();
    expect(resolveAssetSourceMock).not.toHaveBeenCalled();
  });

  test('drops an origin claimed by a user-supplied image', () => {
    // `image={apiResponse.icon}` must not stamp itself bundled and skip the host policy.
    const source = {
      uri: 'http://192.168.1.1/admin/pin.png',
      origin: 'bundled',
    } as const;

    const resolved = resolveMarkerImage(source);

    expect(resolved).toEqual({ uri: 'http://192.168.1.1/admin/pin.png' });
    expect(resolved?.origin).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // A re-render hits the cache, so the warning does not repeat.
    resolveMarkerImage({ ...source });
    expect(warnSpy).toHaveBeenCalledTimes(1);
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
