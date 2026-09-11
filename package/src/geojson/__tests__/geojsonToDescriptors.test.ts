import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { geojsonToOverlayDescriptors } from '../geojsonToDescriptors';
import type {
  GeojsonFeature,
  GeojsonFeatureCollection,
  GeojsonPosition,
} from '../../types/geojson';

const warnSpy = spyOn(console, 'warn');

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  warnSpy.mockClear();
});

const warsawPoint = [21.0122, 52.2297] as const;

function closedRing(
  positions: ReadonlyArray<readonly [number, number, ...number[]]>,
): GeojsonPosition[] {
  const first = positions[0];
  if (first == null) {
    return [];
  }

  return [
    ...positions.map((position): GeojsonPosition => [
      position[0],
      position[1],
      ...position.slice(2),
    ]),
    [first[0], first[1], ...first.slice(2)],
  ];
}

describe('geojsonToOverlayDescriptors', () => {
  test('converts Point, LineString, and Polygon features', () => {
    const collection: GeojsonFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'hub',
          properties: {
            name: 'Bistro Central',
            'marker-color': '#FF9500',
            zIndex: 9,
          },
          geometry: { type: 'Point', coordinates: [...warsawPoint] },
        },
        {
          type: 'Feature',
          id: 'route',
          properties: { stroke: '#FF3B30', 'stroke-width': 4, zIndex: 8 },
          geometry: {
            type: 'LineString',
            coordinates: [
              [21.005, 52.225],
              [21.0122, 52.2297],
              [21.02, 52.235],
            ],
          },
        },
        {
          type: 'Feature',
          id: 'zone',
          properties: {
            fill: '#34C759',
            'fill-opacity': 0.25,
            stroke: '#34C759',
            zIndex: 7,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              closedRing([
                [21.0, 52.238],
                [21.015, 52.242],
                [21.028, 52.235],
                [21.008, 52.22],
              ]),
            ],
          },
        },
      ],
    };

    const overlays = geojsonToOverlayDescriptors(collection, {
      id: 'delivery',
      markerColor: '#007AFF',
      zIndex: 1,
    });

    expect(overlays.markers).toEqual([
      {
        id: 'delivery:hub:marker-0',
        coordinate: { latitude: 52.2297, longitude: 21.0122 },
        title: 'Bistro Central',
        markerColor: '#FF9500',
        zIndex: 9,
      },
    ]);
    expect(overlays.polylines).toHaveLength(1);
    expect(overlays.polylines[0]?.id).toBe('delivery:route:polyline-0');
    expect(overlays.polylines[0]?.strokeColor).toBe('#FF3B30');
    expect(overlays.polylines[0]?.strokeWidth).toBe(4);
    expect(overlays.polylines[0]?.zIndex).toBe(8);
    expect(overlays.polygons).toHaveLength(1);
    expect(overlays.polygons[0]?.id).toBe('delivery:zone:polygon-0');
    expect(overlays.polygons[0]?.fillColor).toBe('#34C75940');
    expect(overlays.polygons[0]?.zIndex).toBe(7);
    expect(overlays.polygons[0]?.coordinates).toHaveLength(4);
    expect(overlays.featuresByOverlayId['delivery:hub:marker-0']?.id).toBe(
      'hub',
    );
  });

  test('expands MultiPoint, MultiLineString, and MultiPolygon', () => {
    const overlays = geojsonToOverlayDescriptors({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'stops',
          properties: { title: 'Stops' },
          geometry: {
            type: 'MultiPoint',
            coordinates: [
              [21.0, 52.22],
              [21.02, 52.24],
            ],
          },
        },
        {
          type: 'Feature',
          properties: null,
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                [21.0, 52.22],
                [21.01, 52.23],
              ],
              [
                [21.02, 52.24],
                [21.03, 52.25],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: null,
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                closedRing([
                  [21.0, 52.22],
                  [21.01, 52.22],
                  [21.01, 52.23],
                ]),
              ],
              [
                closedRing([
                  [21.02, 52.24],
                  [21.03, 52.24],
                  [21.03, 52.25],
                ]),
                closedRing([
                  [21.022, 52.242],
                  [21.024, 52.242],
                  [21.024, 52.244],
                ]),
              ],
            ],
          },
        },
      ],
    });

    expect(overlays.markers).toHaveLength(2);
    expect(overlays.markers[0]?.id).toBe('geojson:stops:marker-0');
    expect(overlays.markers[1]?.id).toBe('geojson:stops:marker-1');
    expect(overlays.polylines).toHaveLength(2);
    expect(overlays.polygons).toHaveLength(2);
    expect(overlays.polygons[0]?.holes).toBeUndefined();
    expect(overlays.polygons[1]?.holes).toEqual([
      [
        { latitude: 52.242, longitude: 21.022 },
        { latitude: 52.242, longitude: 21.024 },
        { latitude: 52.244, longitude: 21.024 },
      ],
    ]);
  });

  test('flattens GeometryCollection onto the original feature', () => {
    const overlays = geojsonToOverlayDescriptors({
      type: 'Feature',
      id: 'mixed',
      properties: { name: 'Mixed' },
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [21.0, 52.22] },
          {
            type: 'LineString',
            coordinates: [
              [21.0, 52.22],
              [21.01, 52.23],
            ],
          },
        ],
      },
    });

    expect(overlays.markers).toHaveLength(1);
    expect(overlays.polylines).toHaveLength(1);
    expect(
      overlays.featuresByOverlayId[overlays.markers[0]?.id ?? '']?.id,
    ).toBe('mixed');
    expect(
      overlays.featuresByOverlayId[overlays.polylines[0]?.id ?? '']?.properties,
    ).toEqual({ name: 'Mixed' });
  });

  test('ignores altitude and preserves polygon holes', () => {
    const source: GeojsonFeature = {
      type: 'Feature',
      id: 'zone',
      properties: null,
      geometry: {
        type: 'Polygon',
        coordinates: [
          closedRing([
            [21.0, 52.22, 10],
            [21.02, 52.22, 10],
            [21.02, 52.24, 10],
            [21.0, 52.24, 10],
          ]),
          closedRing([
            [21.005, 52.225],
            [21.01, 52.225],
            [21.01, 52.23],
          ]),
        ],
      },
    };
    const overlays = geojsonToOverlayDescriptors(source);

    expect(overlays.polygons).toHaveLength(1);
    expect(overlays.polygons[0]?.coordinates).toEqual([
      { latitude: 52.22, longitude: 21.0 },
      { latitude: 52.22, longitude: 21.02 },
      { latitude: 52.24, longitude: 21.02 },
      { latitude: 52.24, longitude: 21.0 },
    ]);
    expect(overlays.polygons[0]?.holes).toEqual([
      [
        { latitude: 52.225, longitude: 21.005 },
        { latitude: 52.225, longitude: 21.01 },
        { latitude: 52.23, longitude: 21.01 },
      ],
    ]);
    expect(overlays.featuresByOverlayId['geojson:zone:polygon-0']).toBe(source);
    expect(
      source.geometry?.type === 'Polygon' && source.geometry.coordinates[0],
    ).toEqual([
      [21.0, 52.22, 10],
      [21.02, 52.22, 10],
      [21.02, 52.24, 10],
      [21.0, 52.24, 10],
      [21.0, 52.22, 10],
    ]);
  });

  test('applies component style defaults when properties are absent', () => {
    const overlays = geojsonToOverlayDescriptors(
      {
        type: 'Feature',
        properties: null,
        geometry: {
          type: 'LineString',
          coordinates: [
            [21.0, 52.22],
            [21.01, 52.23],
          ],
        },
      },
      {
        strokeColor: '#007AFF',
        markerColor: '#FF9500',
        strokeWidth: 3,
        tappable: true,
        title: 'Fallback',
        zIndex: 5,
      },
    );
    const pointOverlays = geojsonToOverlayDescriptors(
      {
        type: 'Point',
        coordinates: [21.0, 52.22],
      },
      {
        markerColor: '#FF9500',
        title: 'Fallback',
        zIndex: 5,
      },
    );

    expect(overlays.polylines[0]?.strokeColor).toBe('#007AFF');
    expect(overlays.polylines[0]?.strokeWidth).toBe(3);
    expect(overlays.polylines[0]?.tappable).toBe(true);
    expect(overlays.polylines[0]?.zIndex).toBe(5);
    expect(pointOverlays.markers[0]?.markerColor).toBe('#FF9500');
    expect(pointOverlays.markers[0]?.title).toBe('Fallback');
    expect(pointOverlays.markers[0]?.zIndex).toBe(5);
  });

  test('skips invalid geometry without throwing', () => {
    const overlays = geojsonToOverlayDescriptors({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: null,
          geometry: { type: 'Point', coordinates: [21] },
        },
        {
          type: 'Feature',
          properties: null,
          geometry: null,
        },
      ],
    });

    expect(overlays.markers).toEqual([]);
    expect(overlays.polylines).toEqual([]);
    expect(overlays.polygons).toEqual([]);
  });
});
