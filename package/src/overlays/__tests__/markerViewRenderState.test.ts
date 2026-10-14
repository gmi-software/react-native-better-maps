import { describe, expect, test } from 'bun:test';
import type { NativeMarkerViewRenderState } from '../../native/specs/MapView.nitro';
import {
  clusterMemberCoordinates,
  markerViewRenderStatesEqual,
} from '../markerViewRenderState';

const state: NativeMarkerViewRenderState = {
  markerIds: ['a', 'b'],
  clusters: [
    {
      id: 'c:grid',
      coordinate: { latitude: 52, longitude: 21 },
      markerIds: ['c', 'd'],
    },
  ],
};

describe('markerViewRenderStatesEqual', () => {
  test('an equivalent state republished by native renders nothing', () => {
    expect(markerViewRenderStatesEqual(state, structuredClone(state))).toBe(
      true,
    );
    expect(markerViewRenderStatesEqual(null, null)).toBe(true);
    expect(markerViewRenderStatesEqual(null, state)).toBe(false);
  });

  test('a marker mounted or unmounted is a change', () => {
    expect(
      markerViewRenderStatesEqual(state, { ...state, markerIds: ['a'] }),
    ).toBe(false);
  });

  test('a cluster that moved or changed members is a change, also at the same count', () => {
    const moved = structuredClone(state);
    moved.clusters[0].coordinate.longitude = 21.5;
    expect(markerViewRenderStatesEqual(state, moved)).toBe(false);

    const swapped = structuredClone(state);
    swapped.clusters[0].markerIds = ['c', 'e'];
    expect(markerViewRenderStatesEqual(state, swapped)).toBe(false);
  });
});

describe('clusterMemberCoordinates', () => {
  test('fits only the members, live and SDK markers alike', () => {
    const first = { latitude: 52.2297, longitude: 21.0122 };
    const second = { latitude: 52.2302, longitude: 21.01285 };

    expect(
      clusterMemberCoordinates(
        ['live', 'sdk'],
        [
          { id: 'outside', coordinate: { latitude: 50, longitude: 20 } },
          { id: 'live', coordinate: first },
          { id: 'sdk', coordinate: second },
        ],
      ),
    ).toEqual([first, second]);
  });

  test('a stale cluster whose members are gone fits nothing', () => {
    expect(
      clusterMemberCoordinates(
        ['removed'],
        [{ id: 'new', coordinate: { latitude: 52, longitude: 21 } }],
      ),
    ).toEqual([]);
  });
});
