import { createElement } from 'react';
import { describe, expect, test } from 'bun:test';
import { Polygon } from '../../components/Polygon';
import { Polyline } from '../../components/Polyline';
import type { OverlayCollectorState } from '../overlayCollect';

import { collectOverlayChild } from '../collectOverlayChild';

const dependencies = { resolveMarkerImage: () => undefined };

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

  test('forwards polyline zIndex to the descriptor', () => {
    const state = createState();

    collectOverlayChild(
      createElement(Polyline, {
        id: 'route',
        coordinates: [
          { latitude: 52.2297, longitude: 21.0122 },
          { latitude: 52.237, longitude: 21.017 },
        ],
        zIndex: 4,
      }),
      state,
      dependencies,
    );

    expect(state.polylines).toHaveLength(1);
    expect(state.polylines[0]?.zIndex).toBe(4);
  });

  test('forwards polygon zIndex and two-ring holes to the descriptor', () => {
    const state = createState();
    const coordinates = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 4 },
      { latitude: 4, longitude: 4 },
      { latitude: 4, longitude: 0 },
    ];
    const hole = [
      { latitude: 1, longitude: 1 },
      { latitude: 1, longitude: 2 },
      { latitude: 2, longitude: 2 },
      { latitude: 2, longitude: 1 },
    ];

    collectOverlayChild(
      createElement(Polygon, {
        id: 'donut',
        coordinates,
        holes: [hole],
        zIndex: 6,
      }),
      state,
      dependencies,
    );

    expect(state.polygons).toHaveLength(1);
    expect(state.polygons[0]?.zIndex).toBe(6);
    expect(state.polygons[0]?.holes).toEqual([hole]);
  });

  test('leaves polyline zIndex and polygon holes unset when omitted', () => {
    const state = createState();
    const polylineCoordinates = [
      { latitude: 52.2297, longitude: 21.0122 },
      { latitude: 52.237, longitude: 21.017 },
    ];
    const polygonCoordinates = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 1, longitude: 1 },
    ];

    collectOverlayChild(
      createElement(Polyline, {
        id: 'plain-line',
        coordinates: polylineCoordinates,
      }),
      state,
      dependencies,
    );
    collectOverlayChild(
      createElement(Polygon, {
        id: 'plain-area',
        coordinates: polygonCoordinates,
      }),
      state,
      dependencies,
    );

    expect(state.polylines[0]?.zIndex).toBeUndefined();
    expect(state.polygons[0]?.zIndex).toBeUndefined();
    expect(state.polygons[0]?.holes).toBeUndefined();
  });
});
