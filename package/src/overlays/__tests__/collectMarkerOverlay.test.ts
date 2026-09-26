import { describe, expect, test } from 'bun:test';
import type { MarkerProps } from '../../types/overlays';
import { createOverlayCollectorState } from '../overlayCollect';

import { collectMarkerOverlay } from '../collectMarkerOverlay';

const resolveMarkerImage = () => undefined;

describe('collectMarkerOverlay', () => {
  test('forwards markerColor and zIndex to the descriptor', () => {
    const state = createOverlayCollectorState();
    const props: MarkerProps = {
      id: 'styled',
      coordinate: { latitude: 52.2297, longitude: 21.0122 },
      markerColor: '#FF9500',
      zIndex: 5,
    };

    collectMarkerOverlay('styled', props, state, resolveMarkerImage);

    expect(state.markers[0]?.markerColor).toBe('#FF9500');
    expect(state.markers[0]?.zIndex).toBe(5);
  });

  test('leaves markerColor and zIndex unset when omitted', () => {
    const state = createOverlayCollectorState();

    collectMarkerOverlay(
      'marker-0',
      { coordinate: { latitude: 52.2297, longitude: 21.0122 } },
      state,
      resolveMarkerImage,
    );

    expect(state.markers[0]?.markerColor).toBeUndefined();
    expect(state.markers[0]?.zIndex).toBeUndefined();
  });
});
