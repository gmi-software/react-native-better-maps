import { expect, test } from 'bun:test';
import { markerViewRenderStatesEqual } from '../markerViewRenderState';
import type { NativeMarkerViewRenderState } from '../../native/specs/MapView.nitro';

const state: NativeMarkerViewRenderState = {
  markerViewIds: ['visible'],
  clusters: [
    {
      id: 'cluster',
      coordinate: { latitude: 52, longitude: 21 },
      markerIds: ['a', 'b'],
      region: {
        latitude: 52,
        longitude: 21,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
    },
  ],
};

test('reinstalling a native callback with equivalent data does not trigger a render loop', () => {
  expect(markerViewRenderStatesEqual(state, structuredClone(state))).toBe(true);
  expect(markerViewRenderStatesEqual(null, state)).toBe(false);
});

test('same-count membership and expansion-bound changes refresh the JSX cluster', () => {
  const members = structuredClone(state);
  members.clusters[0].markerIds = ['a', 'c'];
  expect(markerViewRenderStatesEqual(state, members)).toBe(false);
  const bounds = structuredClone(state);
  bounds.clusters[0].region.longitudeDelta = 0.02;
  expect(markerViewRenderStatesEqual(state, bounds)).toBe(false);
});
