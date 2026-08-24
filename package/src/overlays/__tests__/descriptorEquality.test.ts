import { describe, expect, test } from 'bun:test';
import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../../native/specs/overlays';
import {
  circleDescriptorsEqual,
  circleListsEqual,
  descriptorListsEqual,
  enteringAnimationsEqual,
  markerDescriptorsEqual,
  markerListsEqual,
  polygonDescriptorsEqual,
  polygonListsEqual,
  polylineDescriptorsEqual,
  polylineListsEqual,
} from '../descriptorEquality';

/**
 * These comparators decide whether the overlay arrays keep their identity, and
 * Nitro skips a prop whose identity is unchanged. A field the comparator misses
 * is therefore a map update that never reaches the native side, so every field
 * of every descriptor gets a case here.
 *
 * Each case returns a new descriptor rather than mutating one, so a case only
 * changes the field it names.
 */
type Change<Descriptor> = [string, (base: Descriptor) => Descriptor];

function describeFieldCoverage<Descriptor>(
  name: string,
  base: Descriptor,
  descriptorsEqual: (left: Descriptor, right: Descriptor) => boolean,
  changes: Array<Change<Descriptor>>,
) {
  describe(name, () => {
    test('treats a structural clone as equal', () => {
      expect(descriptorsEqual(base, structuredClone(base))).toBe(true);
    });

    test('treats the same reference as equal', () => {
      expect(descriptorsEqual(base, base)).toBe(true);
    });

    for (const [field, change] of changes) {
      test(`detects a change to ${field}`, () => {
        expect(descriptorsEqual(base, change(base))).toBe(false);
      });
    }
  });
}

const baseMarker: MarkerDescriptor = {
  id: 'marker-1',
  coordinate: { latitude: 52.2297, longitude: 21.0122 },
  title: 'Warsaw',
  subtitle: 'Capital',
  draggable: true,
  clusterable: true,
  image: { uri: 'asset:/pin.png', width: 32, height: 48, scale: 2 },
  anchor: { x: 0.5, y: 1 },
  centerOffset: { x: 1, y: -2 },
  rotation: 45,
  flat: true,
  opacity: 0.9,
  enteringAnimation: {
    kind: 'fade',
    duration: 200,
    delay: 50,
    reduceMotion: 'system',
  },
};

describeFieldCoverage(
  'markerDescriptorsEqual',
  baseMarker,
  markerDescriptorsEqual,
  [
    ['id', (d) => ({ ...d, id: 'marker-2' })],
    [
      'coordinate.latitude',
      (d) => ({ ...d, coordinate: { ...d.coordinate, latitude: 0 } }),
    ],
    [
      'coordinate.longitude',
      (d) => ({ ...d, coordinate: { ...d.coordinate, longitude: 0 } }),
    ],
    ['title', (d) => ({ ...d, title: 'Krakow' })],
    ['a cleared title', (d) => ({ ...d, title: undefined })],
    ['subtitle', (d) => ({ ...d, subtitle: 'Other' })],
    ['draggable', (d) => ({ ...d, draggable: false })],
    ['clusterable', (d) => ({ ...d, clusterable: false })],
    [
      'image.uri',
      (d) => ({ ...d, image: { ...d.image, uri: 'asset:/other.png' } }),
    ],
    [
      'image.width',
      (d) => ({
        ...d,
        image: { ...d.image, uri: 'asset:/pin.png', width: 33 },
      }),
    ],
    [
      'image.height',
      (d) => ({
        ...d,
        image: { ...d.image, uri: 'asset:/pin.png', height: 49 },
      }),
    ],
    [
      'image.scale',
      (d) => ({ ...d, image: { ...d.image, uri: 'asset:/pin.png', scale: 3 } }),
    ],
    ['a cleared image', (d) => ({ ...d, image: undefined })],
    ['anchor.x', (d) => ({ ...d, anchor: { x: 0, y: 1 } })],
    ['anchor.y', (d) => ({ ...d, anchor: { x: 0.5, y: 0 } })],
    ['a cleared anchor', (d) => ({ ...d, anchor: undefined })],
    ['centerOffset.x', (d) => ({ ...d, centerOffset: { x: 9, y: -2 } })],
    ['centerOffset.y', (d) => ({ ...d, centerOffset: { x: 1, y: 9 } })],
    ['a cleared centerOffset', (d) => ({ ...d, centerOffset: undefined })],
    ['rotation', (d) => ({ ...d, rotation: 90 })],
    ['flat', (d) => ({ ...d, flat: false })],
    ['opacity', (d) => ({ ...d, opacity: 0.5 })],
    [
      'enteringAnimation.kind',
      (d) => ({
        ...d,
        enteringAnimation: { ...d.enteringAnimation, kind: 'fade-scale' },
      }),
    ],
    [
      'enteringAnimation.duration',
      (d) => ({
        ...d,
        enteringAnimation: {
          ...d.enteringAnimation,
          kind: 'fade',
          duration: 400,
        },
      }),
    ],
    [
      'enteringAnimation.delay',
      (d) => ({
        ...d,
        enteringAnimation: { ...d.enteringAnimation, kind: 'fade', delay: 0 },
      }),
    ],
    [
      'enteringAnimation.reduceMotion',
      (d) => ({
        ...d,
        enteringAnimation: {
          ...d.enteringAnimation,
          kind: 'fade',
          reduceMotion: 'never',
        },
      }),
    ],
    [
      'a cleared enteringAnimation',
      (d) => ({ ...d, enteringAnimation: undefined }),
    ],
  ],
);

const basePolyline: PolylineDescriptor = {
  id: 'polyline-1',
  coordinates: [
    { latitude: 52.2297, longitude: 21.0122 },
    { latitude: 52.237, longitude: 21.017 },
  ],
  strokeColor: '#FF0000',
  strokeWidth: 3,
  tappable: true,
};

describeFieldCoverage(
  'polylineDescriptorsEqual',
  basePolyline,
  polylineDescriptorsEqual,
  [
    ['id', (d) => ({ ...d, id: 'polyline-2' })],
    [
      'a coordinate',
      (d) => ({
        ...d,
        coordinates: [d.coordinates[0], { latitude: 53, longitude: 21.017 }],
      }),
    ],
    [
      'the coordinate count',
      (d) => ({ ...d, coordinates: d.coordinates.slice(0, -1) }),
    ],
    [
      'the coordinate order',
      (d) => ({ ...d, coordinates: [...d.coordinates].reverse() }),
    ],
    ['strokeColor', (d) => ({ ...d, strokeColor: '#00FF00' })],
    ['strokeWidth', (d) => ({ ...d, strokeWidth: 4 })],
    ['tappable', (d) => ({ ...d, tappable: false })],
  ],
);

const basePolygon: PolygonDescriptor = {
  id: 'polygon-1',
  coordinates: [
    { latitude: 52.2297, longitude: 21.0122 },
    { latitude: 52.237, longitude: 21.017 },
    { latitude: 52.24, longitude: 21.03 },
  ],
  fillColor: '#0000FF80',
  strokeColor: '#0000FF',
  strokeWidth: 2,
  tappable: true,
};

describeFieldCoverage(
  'polygonDescriptorsEqual',
  basePolygon,
  polygonDescriptorsEqual,
  [
    ['id', (d) => ({ ...d, id: 'polygon-2' })],
    [
      'a coordinate',
      (d) => ({
        ...d,
        coordinates: [
          { latitude: 52.2297, longitude: 22 },
          ...d.coordinates.slice(1),
        ],
      }),
    ],
    [
      'the coordinate count',
      (d) => ({ ...d, coordinates: d.coordinates.slice(0, -1) }),
    ],
    ['fillColor', (d) => ({ ...d, fillColor: '#00FF0080' })],
    ['strokeColor', (d) => ({ ...d, strokeColor: '#00FF00' })],
    ['strokeWidth', (d) => ({ ...d, strokeWidth: 5 })],
    ['tappable', (d) => ({ ...d, tappable: false })],
  ],
);

const baseCircle: CircleDescriptor = {
  id: 'circle-1',
  center: { latitude: 52.2297, longitude: 21.0122 },
  radius: 500,
  fillColor: '#0000FF80',
  strokeColor: '#0000FF',
  strokeWidth: 2,
  tappable: true,
};

describeFieldCoverage(
  'circleDescriptorsEqual',
  baseCircle,
  circleDescriptorsEqual,
  [
    ['id', (d) => ({ ...d, id: 'circle-2' })],
    [
      'center.latitude',
      (d) => ({ ...d, center: { ...d.center, latitude: 53 } }),
    ],
    [
      'center.longitude',
      (d) => ({ ...d, center: { ...d.center, longitude: 22 } }),
    ],
    ['radius', (d) => ({ ...d, radius: 600 })],
    ['fillColor', (d) => ({ ...d, fillColor: '#00FF0080' })],
    ['strokeColor', (d) => ({ ...d, strokeColor: '#00FF00' })],
    ['strokeWidth', (d) => ({ ...d, strokeWidth: 5 })],
    ['tappable', (d) => ({ ...d, tappable: false })],
  ],
);

describe('shared nested objects', () => {
  // Descriptors alias the objects handed in by the caller, so two distinct
  // descriptors can share one coordinate object. Mutating that object in place
  // is deliberately invisible here: the map is driven by immutable data, and
  // callers must build a new object instead. Documented in the README.
  test('does not see a coordinate mutated in place', () => {
    const shared = { latitude: 1, longitude: 2 };
    const left: MarkerDescriptor = { id: 'm1', coordinate: shared };
    const right: MarkerDescriptor = { id: 'm1', coordinate: shared };

    shared.latitude = 99;

    expect(markerDescriptorsEqual(left, right)).toBe(true);
  });

  test('sees a coordinate replaced with a new object', () => {
    const left: MarkerDescriptor = {
      id: 'm1',
      coordinate: { latitude: 1, longitude: 2 },
    };
    const right: MarkerDescriptor = {
      id: 'm1',
      coordinate: { latitude: 99, longitude: 2 },
    };

    expect(markerDescriptorsEqual(left, right)).toBe(false);
  });
});

describe('descriptorListsEqual', () => {
  const list = [baseMarker, { ...baseMarker, id: 'marker-2' }];

  test('short-circuits on the same reference', () => {
    expect(descriptorListsEqual(list, list, markerDescriptorsEqual)).toBe(true);
  });

  test('accepts a structurally equal list', () => {
    expect(
      descriptorListsEqual(list, structuredClone(list), markerDescriptorsEqual),
    ).toBe(true);
  });

  test('rejects a shorter list', () => {
    expect(
      descriptorListsEqual(list, [baseMarker], markerDescriptorsEqual),
    ).toBe(false);
  });

  test('rejects a longer list', () => {
    expect(
      descriptorListsEqual(list, [...list, baseMarker], markerDescriptorsEqual),
    ).toBe(false);
  });

  test('rejects a reordered list', () => {
    expect(
      descriptorListsEqual(list, [...list].reverse(), markerDescriptorsEqual),
    ).toBe(false);
  });

  test('rejects a list with one changed descriptor', () => {
    const changed = [list[0], { ...list[1], title: 'Different' }];

    expect(descriptorListsEqual(list, changed, markerDescriptorsEqual)).toBe(
      false,
    );
  });

  test('accepts two empty lists', () => {
    expect(descriptorListsEqual([], [], markerDescriptorsEqual)).toBe(true);
  });
});

describe('the per-overlay list comparators', () => {
  // Four near-identical wrappers - these pin that each one reaches its own item
  // comparator, which a copy-paste slip would otherwise hide.
  test('markerListsEqual compares markers', () => {
    expect(markerListsEqual([baseMarker], [structuredClone(baseMarker)])).toBe(
      true,
    );
    expect(
      markerListsEqual([baseMarker], [{ ...baseMarker, opacity: 0.1 }]),
    ).toBe(false);
  });

  test('polylineListsEqual compares polylines', () => {
    expect(
      polylineListsEqual([basePolyline], [structuredClone(basePolyline)]),
    ).toBe(true);
    expect(
      polylineListsEqual([basePolyline], [{ ...basePolyline, strokeWidth: 9 }]),
    ).toBe(false);
  });

  test('polygonListsEqual compares polygons', () => {
    expect(
      polygonListsEqual([basePolygon], [structuredClone(basePolygon)]),
    ).toBe(true);
    expect(
      polygonListsEqual(
        [basePolygon],
        [{ ...basePolygon, fillColor: '#123456' }],
      ),
    ).toBe(false);
  });

  test('circleListsEqual compares circles', () => {
    expect(circleListsEqual([baseCircle], [structuredClone(baseCircle)])).toBe(
      true,
    );
    expect(circleListsEqual([baseCircle], [{ ...baseCircle, radius: 1 }])).toBe(
      false,
    );
  });
});

describe('enteringAnimationsEqual', () => {
  test('treats two unset animations as equal', () => {
    expect(enteringAnimationsEqual(undefined, undefined)).toBe(true);
  });

  test('treats a set and an unset animation as different', () => {
    expect(enteringAnimationsEqual({ kind: 'fade' }, undefined)).toBe(false);
    expect(enteringAnimationsEqual(undefined, { kind: 'fade' })).toBe(false);
  });

  test('compares every field', () => {
    const base = {
      kind: 'fade',
      duration: 200,
      delay: 25,
      reduceMotion: 'never',
    } as const;

    expect(enteringAnimationsEqual(base, { ...base })).toBe(true);
    expect(enteringAnimationsEqual(base, { ...base, kind: 'fade-scale' })).toBe(
      false,
    );
    expect(enteringAnimationsEqual(base, { ...base, duration: 300 })).toBe(
      false,
    );
    expect(enteringAnimationsEqual(base, { ...base, delay: 0 })).toBe(false);
    expect(
      enteringAnimationsEqual(base, { ...base, reduceMotion: 'system' }),
    ).toBe(false);
  });
});
