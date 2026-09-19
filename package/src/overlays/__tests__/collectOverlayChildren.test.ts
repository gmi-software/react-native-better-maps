import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { createElement, Fragment, memo, type ReactNode } from 'react';
import { Marker } from '../../components/Marker';
import { Polyline } from '../../components/Polyline';
import type { MarkerProps } from '../../types/overlays';
import { collectOverlayChildren } from '../collectOverlayChildren';
import type { OverlayCollectorState } from '../overlayCollect';

const dependencies = { resolveMarkerImage: () => undefined };

const coordA = { latitude: 52.2297, longitude: 21.0122 };
const coordB = { latitude: 52.237, longitude: 21.017 };
const coordC = { latitude: 52.24, longitude: 21.02 };

const stores = [
  { id: 'a', coordinate: coordA },
  { id: 'b', coordinate: coordB },
];

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

function collect(children: ReactNode): OverlayCollectorState {
  const state = createState();
  collectOverlayChildren(children, state, dependencies);
  return state;
}

function storeMarkerElements(): ReactNode[] {
  return stores.map((store) =>
    createElement(Marker, {
      key: store.id,
      coordinate: store.coordinate,
    }),
  );
}

afterEach(() => {
  warnSpy.mockClear();
  restoreDevFlag();
});

describe('collectOverlayChildren', () => {
  test('collects a direct array of overlay children in order', () => {
    const state = collect(storeMarkerElements());

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-0',
      'marker-1',
    ]);
    expect(state.markers.map((marker) => marker.coordinate)).toEqual([
      coordA,
      coordB,
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('collects nested arrays in document order with stable fallback ids', () => {
    const state = collect([
      [createElement(Marker, { key: 'a', coordinate: coordA })],
      [
        createElement(Marker, { key: 'b', coordinate: coordB }),
        [createElement(Marker, { key: 'c', coordinate: coordC })],
      ],
    ]);

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-0',
      'marker-1',
      'marker-2',
    ]);
    expect(state.markers.map((marker) => marker.coordinate)).toEqual([
      coordA,
      coordB,
      coordC,
    ]);
  });

  test('unwraps a fragment the same way as direct children', () => {
    const direct = collect(storeMarkerElements());
    const fromFragment = collect(
      createElement(Fragment, null, storeMarkerElements()),
    );

    expect(fromFragment.markers.map((marker) => marker.id)).toEqual(
      direct.markers.map((marker) => marker.id),
    );
    expect(fromFragment.markers.map((marker) => marker.coordinate)).toEqual(
      direct.markers.map((marker) => marker.coordinate),
    );
  });

  test('unwraps a keyed fragment inside an array of overlays', () => {
    const state = collect([
      createElement(Marker, { key: 'direct', coordinate: coordA }),
      createElement(
        Fragment,
        { key: 'group' },
        createElement(Marker, { key: 'inner', coordinate: coordB }),
        createElement(Polyline, {
          key: 'line',
          coordinates: [coordA, coordB],
        }),
      ),
    ]);

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-0',
      'marker-1',
    ]);
    expect(state.polylines.map((polyline) => polyline.id)).toEqual([
      'polyline-0',
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('unwraps a fragment nested inside another fragment', () => {
    const state = collect(
      createElement(
        Fragment,
        null,
        createElement(
          Fragment,
          null,
          createElement(Marker, { coordinate: coordA }),
          createElement(Marker, { coordinate: coordB }),
        ),
      ),
    );

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-0',
      'marker-1',
    ]);
  });

  test('does not invoke wrapper components and warns once under __DEV__', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    let invoked = false;

    function StoreMarkers(): ReactNode {
      invoked = true;
      return createElement(Marker, { coordinate: coordA });
    }

    const state = collect([
      createElement(StoreMarkers),
      createElement(StoreMarkers),
    ]);

    expect(invoked).toBe(false);
    expect(state.markers).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('<StoreMarkers>');
    expect(String(warnSpy.mock.calls[0]?.[0])).not.toContain('[object Object]');
  });

  test('stays silent for wrapper components when __DEV__ is unset', () => {
    delete (globalThis as { __DEV__?: boolean }).__DEV__;

    function StoreMarkers(): ReactNode {
      return createElement(Marker, { coordinate: coordA });
    }

    const state = collect(createElement(StoreMarkers));

    expect(state.markers).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('warns for an unknown host element and keeps neighbouring overlays', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    function NotAnOverlay(): null {
      return null;
    }

    const state = collect([
      createElement(Marker, { coordinate: coordA }),
      createElement(NotAnOverlay),
      createElement('div'),
    ]);

    expect(state.markers.map((marker) => marker.id)).toEqual(['marker-0']);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('<NotAnOverlay>');
    expect(String(warnSpy.mock.calls[1]?.[0])).toContain('<div>');
  });

  test('stays silent for null, false, strings and numbers', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    const state = collect([
      null,
      false,
      'hello',
      42,
      createElement(Marker, { coordinate: coordA }),
    ]);

    expect(state.markers).toHaveLength(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('collects React.memo and forwardRef wrappers around overlay components', () => {
    const FastMarker = memo(Marker);
    const ForwardedMarker = {
      $$typeof: Symbol.for('react.forward_ref'),
      render: Marker,
    } as unknown as (props: MarkerProps) => null;

    const state = collect([
      createElement(FastMarker, { coordinate: coordA }),
      createElement(ForwardedMarker, { coordinate: coordB }),
    ]);

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-0',
      'marker-1',
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('names a memoised unknown wrapper instead of [object Object]', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    function StoreMarkers(): ReactNode {
      return createElement(Marker, { coordinate: coordA });
    }

    const MemoStoreMarkers = memo(StoreMarkers);
    const state = collect(createElement(MemoStoreMarkers));

    expect(state.markers).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0]?.[0]);
    expect(message).toContain('StoreMarkers');
    expect(message).not.toContain('[object Object]');
  });
});
