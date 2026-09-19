import { createElement } from 'react';
import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { Circle } from '../../components/Circle';
import { Geojson } from '../../components/Geojson';
import { Marker } from '../../components/Marker';
import { Polygon } from '../../components/Polygon';
import { Polyline } from '../../components/Polyline';
import type { OverlayCollectorState } from '../overlayCollect';
import { OverlayType, overlayCallbackKey } from '../overlayType';

import { collectOverlayChild } from '../collectOverlayChild';

const dependencies = { resolveMarkerImage: () => undefined };
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

afterEach(() => {
  warnSpy.mockClear();
  restoreDevFlag();
});

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

describe('collectOverlayChild', () => {
  test('skips an invalid polygon without dropping a valid sibling', () => {
    const state = createState();
    const validCoordinates = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 1, longitude: 1 },
    ];

    collectOverlayChild(
      createElement(Polygon, { id: 'bad', coordinates: [] }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polygon, { id: 'good', coordinates: validCoordinates }),
      state,
      dependencies,
    );

    expect(state.polygons).toHaveLength(1);
    expect(state.polygons[0]?.id).toBe('good');
    expect(state.registry.has('polygon:bad')).toBe(false);
  });

  test('keeps key-derived marker ids when an earlier sibling is removed', () => {
    const coordinate = { latitude: 52.23, longitude: 21.0 };
    const before = createState();
    for (const key of ['a', 'b', 'c'] as const) {
      collectOverlayChild(
        createElement(Marker, { key, coordinate, title: key }),
        before,
        dependencies,
      );
    }

    expect(before.markers.map((marker) => marker.id)).toEqual([
      'marker-key-a',
      'marker-key-b',
      'marker-key-c',
    ]);

    const after = createState();
    for (const key of ['b', 'c'] as const) {
      collectOverlayChild(
        createElement(Marker, { key, coordinate, title: key }),
        after,
        dependencies,
      );
    }

    expect(after.markers.map((marker) => marker.id)).toEqual([
      'marker-key-b',
      'marker-key-c',
    ]);
    expect(
      after.registry.has(
        overlayCallbackKey(OverlayType.Marker, 'marker-key-b'),
      ),
    ).toBe(true);
  });

  test('lets an explicit id win over the React key', () => {
    const state = createState();

    collectOverlayChild(
      createElement(Marker, {
        key: 'b',
        id: 'stop-b',
        coordinate: { latitude: 52.23, longitude: 21.0 },
      }),
      state,
      dependencies,
    );

    expect(state.markers[0]?.id).toBe('stop-b');
  });

  test('reports same-kind key collisions and keeps both overlays', () => {
    const state = createState();
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const coordinate = { latitude: 52.23, longitude: 21.0 };

    collectOverlayChild(
      createElement(Marker, { key: 'dup', coordinate, title: 'first' }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Marker, { key: 'dup', coordinate, title: 'second' }),
      state,
      dependencies,
    );

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-key-dup',
      'marker-key-dup#2',
    ]);
    expect(
      warnSpy.mock.calls.some((call) => String(call[0]).includes('#2')),
    ).toBe(true);
  });

  test('derives stable ids for every overlay kind from the React key', () => {
    const state = createState();
    const coordinate = { latitude: 52.23, longitude: 21.0 };
    const line = [coordinate, { latitude: 52.24, longitude: 21.01 }];
    const ring = [...line, { latitude: 52.25, longitude: 21.02 }];
    const geojson = {
      type: 'Feature' as const,
      id: 'hub',
      properties: null,
      geometry: { type: 'Point' as const, coordinates: [21, 52] },
    };

    collectOverlayChild(
      createElement(Marker, { key: 'stop', coordinate }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polyline, { key: 'route', coordinates: line }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polygon, { key: 'zone', coordinates: ring }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Circle, { key: 'radius', center: coordinate, radius: 80 }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Geojson, { key: 'layer', geojson }),
      state,
      dependencies,
    );

    expect(state.markers.map((marker) => marker.id)).toEqual([
      'marker-key-stop',
      'geojson-key-layer:hub:marker-0',
    ]);
    expect(state.polylines[0]?.id).toBe('polyline-key-route');
    expect(state.polygons[0]?.id).toBe('polygon-key-zone');
    expect(state.circles[0]?.id).toBe('circle-key-radius');
  });

  test('keeps key-derived ids for shapes and geojson after a sibling is removed', () => {
    const coordinate = { latitude: 52.23, longitude: 21.0 };
    const line = [coordinate, { latitude: 52.24, longitude: 21.01 }];
    const ring = [...line, { latitude: 52.25, longitude: 21.02 }];
    const geojson = {
      type: 'Feature' as const,
      id: 'hub',
      properties: null,
      geometry: { type: 'Point' as const, coordinates: [21, 52] },
    };

    const before = createState();
    collectOverlayChild(
      createElement(Polyline, { key: 'route-a', coordinates: line }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polyline, { key: 'route-b', coordinates: line }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polygon, { key: 'zone-a', coordinates: ring }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polygon, { key: 'zone-b', coordinates: ring }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Circle, {
        key: 'radius-a',
        center: coordinate,
        radius: 40,
      }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Circle, {
        key: 'radius-b',
        center: coordinate,
        radius: 80,
      }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Geojson, { key: 'layer-a', geojson }),
      before,
      dependencies,
    );
    collectOverlayChild(
      createElement(Geojson, { key: 'layer-b', geojson }),
      before,
      dependencies,
    );

    const after = createState();
    collectOverlayChild(
      createElement(Polyline, { key: 'route-b', coordinates: line }),
      after,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polygon, { key: 'zone-b', coordinates: ring }),
      after,
      dependencies,
    );
    collectOverlayChild(
      createElement(Circle, {
        key: 'radius-b',
        center: coordinate,
        radius: 80,
      }),
      after,
      dependencies,
    );
    collectOverlayChild(
      createElement(Geojson, { key: 'layer-b', geojson }),
      after,
      dependencies,
    );

    expect(before.polylines[1]?.id).toBe('polyline-key-route-b');
    expect(after.polylines[0]?.id).toBe('polyline-key-route-b');
    expect(before.polygons[1]?.id).toBe('polygon-key-zone-b');
    expect(after.polygons[0]?.id).toBe('polygon-key-zone-b');
    expect(before.circles[1]?.id).toBe('circle-key-radius-b');
    expect(after.circles[0]?.id).toBe('circle-key-radius-b');
    expect(before.markers[1]?.id).toBe('geojson-key-layer-b:hub:marker-0');
    expect(after.markers[0]?.id).toBe('geojson-key-layer-b:hub:marker-0');
  });
});
