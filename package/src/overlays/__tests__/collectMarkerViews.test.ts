import { describe, expect, mock, test } from 'bun:test';
import { createElement, Fragment } from 'react';

mock.module('../../native/MarkerViewNative', () => ({
  NativeMarkerView: 'NativeMarkerView',
}));
const { MarkerView } = await import('../../components/MarkerView');
const { collectMarkerViews } = await import('../collectMarkerViews');
const marker = (key: string) =>
  createElement(MarkerView, {
    key,
    coordinate: { latitude: 52, longitude: 21 },
    width: 96,
    height: 48,
    children: null,
  });

describe('live marker collection', () => {
  test('keeps descriptor and unrelated children out of the native child hierarchy', () => {
    const result = collectMarkerViews([
      null,
      false,
      createElement('unrelated'),
      marker('live'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(MarkerView);
  });

  test('preserves separate fragment key scopes and reuses marker props', () => {
    const first = marker('same');
    const second = marker('same');
    const result = collectMarkerViews([
      createElement(Fragment, { key: 'first' }, first),
      createElement(Fragment, { key: 'second' }, second),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe(Fragment);
    expect(result[0].key).not.toBe(result[1].key);
    const nested = (result[0].props as { children: { props: unknown }[] })
      .children;
    expect(nested[0].props).toBe(first.props);
  });

  test('returns an empty collection for descriptor-only maps and empty fragments', () => {
    expect(collectMarkerViews(createElement(Fragment, {}, null))).toEqual([]);
    expect(collectMarkerViews(undefined)).toEqual([]);
  });
});
