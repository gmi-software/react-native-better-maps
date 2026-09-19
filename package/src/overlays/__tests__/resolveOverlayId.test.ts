import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import {
  claimOverlayId,
  resolveOverlayId,
  type OverlayCollectorState,
} from '../overlayCollect';

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

function createState(): OverlayCollectorState {
  return {
    registry: new Map(),
    markers: [],
    polylines: [],
    polygons: [],
    circles: [],
    markerIndex: 0,
    polylineIndex: 0,
    polygonIndex: 0,
    circleIndex: 0,
    geojsonIndex: 0,
    hasMarkerPress: false,
    hasMarkerDragEnd: false,
    hasPolylinePress: false,
    hasPolygonPress: false,
    hasCirclePress: false,
  };
}

afterEach(() => {
  warnSpy.mockClear();
  restoreDevFlag();
});

describe('resolveOverlayId', () => {
  test('uses an explicit id over the React key', () => {
    expect(resolveOverlayId('stop-b', 'b', 'marker', 0)).toBe('stop-b');
  });

  test('namespaces a key when no id is provided', () => {
    expect(resolveOverlayId(undefined, 'b', 'marker', 0)).toBe('marker-key-b');
    expect(resolveOverlayId('', 'route', 'polyline', 3)).toBe(
      'polyline-key-route',
    );
  });

  test('stringifies a numeric key', () => {
    expect(resolveOverlayId(undefined, 12, 'circle', 0)).toBe('circle-key-12');
  });

  test('falls back to a positional id when neither id nor key is set', () => {
    expect(resolveOverlayId(undefined, null, 'marker', 2)).toBe('marker-2');
    expect(resolveOverlayId('', '', 'polygon', 1)).toBe('polygon-1');
  });

  test('warns in __DEV__ when neither id nor key is set', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    resolveOverlayId(undefined, null, 'marker', 0);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('marker-0');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('no id or React key');
  });

  test('stays silent without __DEV__ when falling back to position', () => {
    delete (globalThis as { __DEV__?: boolean }).__DEV__;

    expect(resolveOverlayId(undefined, null, 'marker', 0)).toBe('marker-0');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('claimOverlayId', () => {
  test('returns the first id unchanged and suffixes later collisions', () => {
    const state = createState();

    expect(claimOverlayId(state, 'marker', 'marker-key-b')).toBe(
      'marker-key-b',
    );
    expect(claimOverlayId(state, 'marker', 'marker-key-b')).toBe(
      'marker-key-b#2',
    );
    expect(claimOverlayId(state, 'marker', 'marker-key-b')).toBe(
      'marker-key-b#3',
    );
  });

  test('scopes collisions to the overlay kind', () => {
    const state = createState();

    expect(claimOverlayId(state, 'marker', 'shared')).toBe('shared');
    expect(claimOverlayId(state, 'polyline', 'shared')).toBe('shared');
  });

  test('warns in __DEV__ when the same kind reuses an id', () => {
    const state = createState();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    claimOverlayId(state, 'marker', 'marker-key-b');
    claimOverlayId(state, 'marker', 'marker-key-b');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('marker-key-b');
    expect(warnSpy.mock.calls[0]?.[0]).toContain('marker-key-b#2');
  });
});
