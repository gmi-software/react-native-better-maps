import { createElement, type ReactNode } from 'react';
import { describe, expect, test } from 'bun:test';
import { Circle } from '../../components/Circle';
import { Geojson } from '../../components/Geojson';
import { Marker } from '../../components/Marker';
import { Polygon } from '../../components/Polygon';
import { Polyline } from '../../components/Polyline';
import type { GeojsonFeatureCollection } from '../../types/geojson';
import { OverlayType, overlayCallbackKey } from '../overlayType';

import { collectOverlayChildren } from '../collectOverlayChild';

const dependencies = { resolveMarkerImage: () => undefined };

function collect(children: ReactNode) {
  return collectOverlayChildren(children, dependencies);
}

function ids(overlays: { id: string }[]): string[] {
  return overlays.map((overlay) => overlay.id);
}

const stops = [
  { id: 'a', coordinate: { latitude: 52.24, longitude: 21.0 } },
  { id: 'b', coordinate: { latitude: 52.23, longitude: 21.0 } },
  { id: 'c', coordinate: { latitude: 52.22, longitude: 21.0 } },
];

function stopMarkers(list: typeof stops): ReactNode {
  return list.map((stop) =>
    createElement(Marker, { key: stop.id, coordinate: stop.coordinate }),
  );
}

const ROUTE = [
  { latitude: 52.2297, longitude: 21.0122 },
  { latitude: 52.237, longitude: 21.017 },
];
const AREA = [...ROUTE, { latitude: 52.24, longitude: 21.03 }];

const districts: GeojsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'centre',
      properties: null,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [21.0122, 52.2297],
            [21.017, 52.237],
            [21.03, 52.24],
            [21.0122, 52.2297],
          ],
        ],
      },
    },
  ],
};

describe('collectOverlayChildren', () => {
  test('skips an invalid polygon without dropping a valid sibling', () => {
    const state = collect([
      createElement(Polygon, { id: 'bad', coordinates: [] }),
      createElement(Polygon, { id: 'good', coordinates: AREA }),
    ]);

    expect(ids(state.polygons)).toEqual(['good']);
    expect(
      state.registry.has(overlayCallbackKey(OverlayType.Polygon, 'bad')),
    ).toBe(false);
  });

  test('ignores children that are not overlays', () => {
    const state = collect([
      'text',
      null,
      false,
      createElement('View', { key: 'view' }),
      createElement(Marker, { key: 'a', coordinate: stops[0]!.coordinate }),
    ]);

    expect(ids(state.markers)).toEqual(['a']);
  });
});

describe('overlay ids', () => {
  test('a keyed marker keeps its id when a sibling before it is removed', () => {
    const before = collect(stopMarkers(stops));
    const after = collect(stopMarkers(stops.slice(1)));

    expect(ids(before.markers)).toEqual(['a', 'b', 'c']);
    expect(ids(after.markers)).toEqual(['b', 'c']);
  });

  test('a keyed marker added in front gets an id of its own and the others keep theirs', () => {
    const added = { id: 'z', coordinate: { latitude: 52.25, longitude: 21.0 } };

    const state = collect(stopMarkers([added, ...stops]));

    expect(ids(state.markers)).toEqual(['z', 'a', 'b', 'c']);
  });

  test("a marker's callbacks are registered under its key", () => {
    const events: string[] = [];
    const state = collect(
      stops.map((stop) =>
        createElement(Marker, {
          key: stop.id,
          coordinate: stop.coordinate,
          onPress: () => events.push(`press ${stop.id}`),
          onDragEnd: () => events.push(`drag ${stop.id}`),
        }),
      ),
    );

    const callbacks = state.registry.get(
      overlayCallbackKey(OverlayType.Marker, 'b'),
    );
    callbacks?.onPress?.();
    callbacks?.onDragEnd?.(stops[1]!.coordinate);

    expect(events).toEqual(['press b', 'drag b']);
  });

  test('an id prop wins over the key', () => {
    const state = collect([
      createElement(Marker, {
        key: 'a',
        id: 'pin',
        coordinate: stops[0]!.coordinate,
      }),
    ]);

    expect(ids(state.markers)).toEqual(['pin']);
  });

  test('an id prop keeps its value when a key asking for it comes first', () => {
    const state = collect([
      stopMarkers([{ ...stops[0]!, id: 'home' }]),
      createElement(Marker, {
        key: 'home-pin',
        id: 'home',
        coordinate: stops[1]!.coordinate,
      }),
    ]);

    expect(ids(state.markers)).toEqual(['home#2', 'home']);
  });

  test('the same key in two lists keeps both overlays apart', () => {
    const routes = [{ id: 'r1' }, { id: 'r2' }];

    const state = collect([
      routes.map((route) =>
        createElement(Marker, {
          key: route.id,
          coordinate: stops[0]!.coordinate,
        }),
      ),
      routes.map((route) =>
        createElement(Marker, {
          key: route.id,
          coordinate: stops[2]!.coordinate,
        }),
      ),
    ]);

    expect(ids(state.markers)).toEqual(['r1', 'r2', 'r1#2', 'r2#2']);
  });

  test('an overlay with neither id nor key is numbered apart from keyed ones', () => {
    const withList = (list: typeof stops) => [
      stopMarkers(list),
      createElement(Marker, { coordinate: stops[0]!.coordinate }),
    ];

    expect(ids(collect(withList(stops)).markers)).toEqual([
      'a',
      'b',
      'c',
      'marker-0',
    ]);
    expect(ids(collect(withList(stops.slice(1))).markers)).toEqual([
      'b',
      'c',
      'marker-0',
    ]);
  });

  test('a skipped overlay still holds its position', () => {
    const state = collect([
      createElement(Marker, {
        coordinate: { latitude: Number.NaN, longitude: 0 },
      }),
      createElement(Marker, { coordinate: stops[0]!.coordinate }),
    ]);

    expect(ids(state.markers)).toEqual(['marker-1']);
  });

  test('a numeric key becomes a string id', () => {
    const state = collect([
      [7, 8].map((key) =>
        createElement(Circle, {
          key,
          center: stops[0]!.coordinate,
          radius: 100,
        }),
      ),
    ]);

    expect(ids(state.circles)).toEqual(['7', '8']);
  });

  test('polylines, polygons, circles and Geojson layers take their ids from keys too', () => {
    const shapes = (withLeading: boolean) => [
      withLeading
        ? [
            createElement(Polyline, { key: 'lead-route', coordinates: ROUTE }),
            createElement(Polygon, { key: 'lead-area', coordinates: AREA }),
            createElement(Circle, {
              key: 'lead-zone',
              center: ROUTE[0]!,
              radius: 50,
            }),
            createElement(Geojson, { key: 'lead-layer', geojson: districts }),
          ]
        : [],
      createElement(Polyline, { key: 'route', coordinates: ROUTE }),
      createElement(Polygon, { key: 'area', coordinates: AREA }),
      createElement(Circle, { key: 'zone', center: ROUTE[0]!, radius: 100 }),
      createElement(Geojson, { key: 'districts', geojson: districts }),
    ];

    for (const state of [collect(shapes(true)), collect(shapes(false))]) {
      expect(ids(state.polylines).at(-1)).toBe('route');
      expect(ids(state.polygons).slice(-2)).toEqual([
        'area',
        'districts:centre:polygon-0',
      ]);
      expect(ids(state.circles).at(-1)).toBe('zone');
    }
  });
});
