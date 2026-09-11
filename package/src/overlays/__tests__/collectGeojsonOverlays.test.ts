import { describe, expect, mock, test } from 'bun:test';
import type {
  GeojsonFeatureCollection,
  GeojsonProps,
} from '../../types/geojson';
import { collectGeojsonOverlays } from '../collectGeojsonOverlays';
import type { OverlayCollectorState } from '../overlayCollect';
import { OverlayType, overlayCallbackKey } from '../overlayType';

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

const collection: GeojsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'point',
      properties: { name: 'Point' },
      geometry: { type: 'Point', coordinates: [21, 52] },
    },
    {
      type: 'Feature',
      id: 'line',
      properties: null,
      geometry: {
        type: 'LineString',
        coordinates: [
          [21, 52],
          [21.1, 52.1],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'polygon',
      properties: null,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [21, 52],
            [21.1, 52],
            [21.1, 52.1],
            [21, 52],
          ],
        ],
      },
    },
  ],
};

describe('collectGeojsonOverlays', () => {
  test('routes generated overlay presses to their source features', () => {
    const state = createState();
    const onPress = mock<NonNullable<GeojsonProps['onPress']>>(() => {});

    collectGeojsonOverlays(
      {
        id: 'layer',
        geojson: collection,
        markerColor: '#FF9500',
        onPress,
        zIndex: 4,
      },
      state,
    );

    expect(state.markers).toHaveLength(1);
    expect(state.polylines).toHaveLength(1);
    expect(state.polygons).toHaveLength(1);
    expect(state.polylines[0]?.tappable).toBe(true);
    expect(state.polygons[0]?.tappable).toBe(true);
    expect(state.markers[0]?.markerColor).toBe('#FF9500');
    expect(state.markers[0]?.zIndex).toBe(4);
    expect(state.polylines[0]?.zIndex).toBe(4);
    expect(state.polygons[0]?.zIndex).toBe(4);
    expect(state.hasMarkerPress).toBe(true);
    expect(state.hasPolylinePress).toBe(true);
    expect(state.hasPolygonPress).toBe(true);

    const cases = [
      [OverlayType.Marker, 'layer:point:marker-0', collection.features[0]],
      [OverlayType.Polyline, 'layer:line:polyline-0', collection.features[1]],
      [OverlayType.Polygon, 'layer:polygon:polygon-0', collection.features[2]],
    ] as const;

    for (const [type, id, feature] of cases) {
      state.registry.get(overlayCallbackKey(type, id))?.onPress?.();
      expect(onPress.mock.calls.at(-1)?.[0]).toBe(feature);
    }
  });

  test('respects explicit tappable without installing press handlers', () => {
    const state = createState();

    collectGeojsonOverlays(
      {
        geojson: collection,
        tappable: true,
      },
      state,
    );

    expect(state.polylines[0]?.tappable).toBe(true);
    expect(state.polygons[0]?.tappable).toBe(true);
    expect(state.registry.size).toBe(0);
    expect(state.hasMarkerPress).toBe(false);
    expect(state.hasPolylinePress).toBe(false);
    expect(state.hasPolygonPress).toBe(false);
  });

  test('keeps explicit tappable false when onPress is present', () => {
    const state = createState();

    collectGeojsonOverlays(
      {
        geojson: collection,
        tappable: false,
        onPress: () => {},
      },
      state,
    );

    expect(state.polylines[0]?.tappable).toBe(false);
    expect(state.polygons[0]?.tappable).toBe(false);
    expect(state.registry.size).toBe(3);
  });
});
