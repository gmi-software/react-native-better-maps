import { describe, expect, mock, test } from 'bun:test';

mock.module('../assetSourceResolver', () => ({
  resolveAssetSource: (source: number) => ({
    uri: `asset-${source}.png`,
    width: 40,
    height: 40,
    scale: 2,
  }),
}));

const { normalizeClusterStyle } = await import('../normalizeClusterStyle');

describe('normalizeClusterStyle', () => {
  test('leaves an unset style unset', () => {
    expect(normalizeClusterStyle(undefined)).toBeUndefined();
  });

  test('passes colors and the border width through', () => {
    expect(
      normalizeClusterStyle({
        backgroundColor: '#E30613',
        textColor: '#FFF',
        borderColor: '#FFFFFF80',
        borderWidth: 0,
      }),
    ).toEqual({
      backgroundColor: '#E30613',
      textColor: '#FFF',
      borderColor: '#FFFFFF80',
      borderWidth: 0,
      image: undefined,
    });
  });

  test('resolves a required image like a marker image', () => {
    expect(normalizeClusterStyle({ image: 7 })?.image).toEqual({
      uri: 'asset-7.png',
      width: 40,
      height: 40,
      scale: 2,
      origin: 'bundled',
    });
  });

  test('treats null fields as left out', () => {
    const style = normalizeClusterStyle({
      backgroundColor: null,
      image: null,
    } as never);

    expect(style?.backgroundColor).toBeUndefined();
    expect(style?.image).toBeUndefined();
  });
});
