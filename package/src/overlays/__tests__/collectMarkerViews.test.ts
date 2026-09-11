import { describe, expect, mock, test } from 'bun:test';
import { createElement, Fragment } from 'react';

mock.module('../../native/MarkerViewNative', () => ({
  NativeMarkerView: 'NativeMarkerView',
}));
const { MarkerView } = await import('../../components/MarkerView');
const { collectMarkerViewEntries } = await import('../collectMarkerViews');
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
    const result = collectMarkerViewEntries([
      null,
      false,
      createElement('unrelated'),
      marker('live'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].element.type).toBe(MarkerView);
  });

  test('returns an empty collection for descriptor-only maps and empty fragments', () => {
    expect(collectMarkerViewEntries(createElement(Fragment, {}, null))).toEqual(
      [],
    );
    expect(collectMarkerViewEntries(undefined)).toEqual([]);
  });

  test('clustering identities stay stable across reordering keyed fragments', () => {
    const first = createElement(Fragment, { key: 'first' }, marker('same'));
    const second = createElement(Fragment, { key: 'second' }, marker('same'));
    const before = collectMarkerViewEntries([first, second]);
    const after = collectMarkerViewEntries([second, first]);
    expect(before[0].viewId).not.toBe(before[1].viewId);
    expect(after[1].viewId).toBe(before[0].viewId);
    expect(after[1].element.key).toBe(before[0].element.key);
  });

  test('uses explicit marker ids for cluster membership', () => {
    const node = createElement(MarkerView, {
      ...marker('a').props,
      id: 'place-42',
    });
    expect(collectMarkerViewEntries(node)[0].markerId).toBe('place-42');
  });

  test('a slash in a local key cannot alias a nested fragment path', () => {
    const nested = createElement(Fragment, { key: 'a' }, marker('b'));
    const direct = marker('a/.$b');
    const entries = collectMarkerViewEntries([nested, direct]);
    expect(entries[0].viewId).not.toBe(entries[1].viewId);
    expect(entries[0].markerId).not.toBe(entries[1].markerId);
  });

  test('rejects invalid coordinates before they reach the native cluster engine', () => {
    const node = createElement(MarkerView, {
      ...marker('a').props,
      coordinate: { latitude: Infinity, longitude: 21 },
    });
    expect(() => collectMarkerViewEntries(node)).toThrow(
      'valid latitude and longitude',
    );
  });
});
