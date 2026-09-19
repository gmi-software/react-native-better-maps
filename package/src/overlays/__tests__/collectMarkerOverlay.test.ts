import { describe, expect, test } from 'bun:test';
import type { MarkerProps } from '../../types/overlays';
import type { OverlayCollectorState } from '../overlayCollect';

import { collectMarkerOverlay } from '../collectMarkerOverlay';

const resolveMarkerImage = () => undefined;

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

describe('collectMarkerOverlay', () => {
  test('forwards markerColor and zIndex to the descriptor', () => {
    const state = createState();
    const props: MarkerProps = {
      id: 'styled',
      coordinate: { latitude: 52.2297, longitude: 21.0122 },
      markerColor: '#FF9500',
      zIndex: 5,
    };

    collectMarkerOverlay(props, state, resolveMarkerImage);

    expect(state.markers[0]?.markerColor).toBe('#FF9500');
    expect(state.markers[0]?.zIndex).toBe(5);
  });

  test('leaves markerColor and zIndex unset when omitted', () => {
    const state = createState();

    collectMarkerOverlay(
      { coordinate: { latitude: 52.2297, longitude: 21.0122 } },
      state,
      resolveMarkerImage,
    );

    expect(state.markers[0]?.markerColor).toBeUndefined();
    expect(state.markers[0]?.zIndex).toBeUndefined();
  });

  test('uses the React key when no explicit id is provided', () => {
    const state = createState();

    collectMarkerOverlay(
      { coordinate: { latitude: 52.2297, longitude: 21.0122 } },
      state,
      resolveMarkerImage,
      'b',
    );

    expect(state.markers[0]?.id).toBe('marker-key-b');
  });
});
