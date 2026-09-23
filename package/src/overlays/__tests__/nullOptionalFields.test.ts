import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Circle } from '../../components/Circle';
import { Geojson } from '../../components/Geojson';
import { Marker } from '../../components/Marker';
import { Polygon } from '../../components/Polygon';
import { Polyline } from '../../components/Polyline';
import type {
  CircleDescriptor,
  MarkerImage,
  MarkerDescriptor as NativeMarkerDescriptor,
  OverlayEnteringAnimationDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../../native/specs/overlays';
import type {
  GeojsonFeatureCollection,
  GeojsonProps,
} from '../../types/geojson';
import type {
  CircleProps,
  MarkerDescriptor,
  MarkerProps,
  OverlayEnteringAnimationConfig,
  PolygonProps,
  PolylineProps,
} from '../../types/overlays';
import { collectOverlayChild } from '../collectOverlayChild';
import {
  normalizeCircleDescriptors,
  normalizePolygonDescriptors,
  normalizePolylineDescriptors,
} from '../normalizeShapeDescriptors';
import type { OverlayCollectorState } from '../overlayCollect';

mock.module('../assetSourceResolver', () => ({
  resolveAssetSource: () => null,
}));

const { normalizeMarkerDescriptors } =
  await import('../normalizeMarkerDescriptors');
const { clearResolvedMarkerImageCacheForTests, resolveMarkerImage } =
  await import('../resolveMarkerImage');

/**
 * Nitro throws on a `null` optional descriptor field, for the whole overlay
 * array, so every path from app data to a descriptor - overlay children and
 * bulk props alike - has to treat `null` as absent.
 *
 * Each fixture below lists every optional field of its input type, and the
 * compiler holds it to that: a field added to a spec or props type does not
 * build until it is listed here, and so tested.
 */

/** The keys of `T` that may be left out. */
type OptionalKey<T> = {
  [Key in keyof T]-?: undefined extends T[Key] ? Key : never;
}[keyof T];

/** A value for every optional field of `T`. */
type EveryOptionalField<T> = {
  [Key in OptionalKey<T>]: Exclude<T[Key], undefined>;
};

beforeEach(() => {
  clearResolvedMarkerImageCacheForTests();
});

/** Every descriptor an overlay child produces, whatever its kind. */
function collectChild(child: ReactElement): unknown[] {
  const state: OverlayCollectorState = {
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
  collectOverlayChild(child, state, { resolveMarkerImage });

  return [
    ...state.markers,
    ...state.polylines,
    ...state.polygons,
    ...state.circles,
  ];
}

/** The path to the first `null` inside `value`, such as `result[0].title`. */
function findNull(value: unknown, path = 'result'): string | undefined {
  if (value === null) {
    return path;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  for (const [key, child] of Object.entries(value)) {
    const found = findNull(
      child,
      Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`,
    );
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function withoutField(input: object, field: string): object {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== field),
  );
}

/**
 * For each field of `optional` in turn, expects `null` to collect exactly what
 * leaving the field out collects, with no `null` left anywhere in the result.
 */
function describeNullAsAbsent<Base extends object, Fields extends object>(
  name: string,
  base: Base,
  optional: Fields,
  collect: (input: Base & Fields) => unknown[],
): void {
  // The inputs below break their declared types on purpose: data that is not
  // what its types say is the case under test.
  const collectUntyped = collect as (input: object) => unknown[];
  const complete = { ...base, ...optional };

  describe(name, () => {
    test('collects the complete input', () => {
      expect(collectUntyped(complete).length).toBeGreaterThan(0);
    });

    for (const field of Object.keys(optional)) {
      test(`treats a null ${field} as absent`, () => {
        const result = collectUntyped({ ...complete, [field]: null });

        expect(findNull(result)).toBeUndefined();
        expect(result).toEqual(collectUntyped(withoutField(complete, field)));
      });
    }

    test('treats every optional field null at once as none set', () => {
      const allNull = Object.fromEntries(
        Object.keys(optional).map((field) => [field, null]),
      );
      const result = collectUntyped({ ...base, ...allNull });

      expect(findNull(result)).toBeUndefined();
      expect(result).toEqual(collectUntyped(base));
    });
  });
}

const WARSAW = { latitude: 52.2297, longitude: 21.0122 };
const ROUTE = [WARSAW, { latitude: 52.237, longitude: 21.017 }];
const AREA = [...ROUTE, { latitude: 52.24, longitude: 21.03 }];
const HOLE = [
  { latitude: 52.231, longitude: 21.015 },
  { latitude: 52.232, longitude: 21.016 },
  { latitude: 52.233, longitude: 21.015 },
];

const image = { uri: 'https://example.com/pin.png' };
const imageFields = {
  width: 32,
  height: 48,
  scale: 2,
} satisfies EveryOptionalField<MarkerImage>;

const animation = {
  preset: 'fade',
} satisfies Pick<OverlayEnteringAnimationConfig, 'preset'>;
const animationFields = {
  duration: 200,
  delay: 50,
  reduceMotion: 'system',
} satisfies EveryOptionalField<OverlayEnteringAnimationConfig> &
  Record<OptionalKey<OverlayEnteringAnimationDescriptor>, unknown>;

const markerFields = {
  title: 'Warsaw',
  subtitle: 'Capital',
  draggable: true,
  clusterable: true,
  image: { ...image, ...imageFields },
  markerColor: '#FF9500',
  zIndex: 3,
  anchor: { x: 0.5, y: 1 },
  centerOffset: { x: 1, y: -2 },
  rotation: 45,
  flat: true,
  opacity: 0.9,
  enteringAnimation: { ...animation, ...animationFields },
} satisfies EveryOptionalField<MarkerDescriptor> &
  Record<OptionalKey<NativeMarkerDescriptor>, unknown>;

const markerPropsFields = {
  ...markerFields,
  id: 'pin',
  onPress: () => {},
  onDragEnd: () => {},
} satisfies EveryOptionalField<MarkerProps>;

const polylineFields = {
  strokeColor: '#FF3B30',
  strokeWidth: 3,
  zIndex: 4,
  tappable: true,
} satisfies EveryOptionalField<PolylineDescriptor>;

const polylinePropsFields = {
  id: 'route',
  strokeColor: '#FF3B30',
  strokeWidth: 3,
  tappable: true,
  onPress: () => {},
} satisfies EveryOptionalField<PolylineProps>;

const polygonFields = {
  holes: [HOLE],
  fillColor: '#007AFF80',
  strokeColor: '#007AFF',
  strokeWidth: 2,
  zIndex: 5,
  tappable: true,
} satisfies EveryOptionalField<PolygonDescriptor>;

const polygonPropsFields = {
  id: 'area',
  fillColor: '#007AFF80',
  strokeColor: '#007AFF',
  strokeWidth: 2,
  tappable: true,
  onPress: () => {},
} satisfies EveryOptionalField<PolygonProps>;

const circleFields = {
  fillColor: '#34C75980',
  strokeColor: '#34C759',
  strokeWidth: 2,
  tappable: true,
} satisfies EveryOptionalField<CircleDescriptor>;

const circlePropsFields = {
  ...circleFields,
  id: 'zone',
  onPress: () => {},
} satisfies EveryOptionalField<CircleProps>;

const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: null,
      geometry: { type: 'Point', coordinates: [21.0122, 52.2297] },
    },
    {
      type: 'Feature',
      properties: null,
      geometry: {
        type: 'LineString',
        coordinates: [
          [21.0122, 52.2297],
          [21.017, 52.237],
        ],
      },
    },
    {
      type: 'Feature',
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
} satisfies GeojsonFeatureCollection;

const geojsonPropsFields = {
  id: 'districts',
  strokeColor: '#5856D6',
  fillColor: '#5856D640',
  markerColor: '#AF52DE',
  strokeWidth: 2,
  tappable: true,
  title: 'District',
  zIndex: 1,
  onPress: () => {},
} satisfies EveryOptionalField<GeojsonProps>;

describeNullAsAbsent(
  '<Marker>',
  { coordinate: WARSAW },
  markerPropsFields,
  (props) => collectChild(createElement(Marker, props)),
);

describeNullAsAbsent('<Marker> image', image, imageFields, (markerImage) =>
  collectChild(
    createElement(Marker, { coordinate: WARSAW, image: markerImage }),
  ),
);

describeNullAsAbsent(
  '<Marker> enteringAnimation',
  animation,
  animationFields,
  (enteringAnimation) =>
    collectChild(
      createElement(Marker, { coordinate: WARSAW, enteringAnimation }),
    ),
);

describeNullAsAbsent(
  'markers prop',
  { id: 'pin', coordinate: WARSAW },
  markerFields,
  (descriptor) => normalizeMarkerDescriptors([descriptor]),
);

describeNullAsAbsent('markers prop image', image, imageFields, (markerImage) =>
  normalizeMarkerDescriptors([
    { id: 'pin', coordinate: WARSAW, image: markerImage },
  ]),
);

describeNullAsAbsent(
  'markers prop enteringAnimation',
  animation,
  animationFields,
  (enteringAnimation) =>
    normalizeMarkerDescriptors([
      { id: 'pin', coordinate: WARSAW, enteringAnimation },
    ]),
);

describeNullAsAbsent(
  '<Polyline>',
  { coordinates: ROUTE },
  polylinePropsFields,
  (props) => collectChild(createElement(Polyline, props)),
);

describeNullAsAbsent(
  'polylines prop',
  { id: 'route', coordinates: ROUTE },
  polylineFields,
  (descriptor) => normalizePolylineDescriptors([descriptor]),
);

describeNullAsAbsent(
  '<Polygon>',
  { coordinates: AREA },
  polygonPropsFields,
  (props) => collectChild(createElement(Polygon, props)),
);

describeNullAsAbsent(
  'polygons prop',
  { id: 'area', coordinates: AREA },
  polygonFields,
  (descriptor) => normalizePolygonDescriptors([descriptor]),
);

describeNullAsAbsent(
  '<Circle>',
  { center: WARSAW, radius: 250 },
  circlePropsFields,
  (props) => collectChild(createElement(Circle, props)),
);

describeNullAsAbsent(
  'circles prop',
  { id: 'zone', center: WARSAW, radius: 250 },
  circleFields,
  (descriptor) => normalizeCircleDescriptors([descriptor]),
);

describeNullAsAbsent('<Geojson>', { geojson }, geojsonPropsFields, (props) =>
  collectChild(createElement(Geojson, props)),
);

describe('complete descriptors', () => {
  test('the GeoJSON fixture yields a marker, a polyline and a polygon', () => {
    expect(collectChild(createElement(Geojson, { geojson }))).toHaveLength(3);
  });

  test('bulk shapes keep every field', () => {
    const polyline = { id: 'route', coordinates: ROUTE, ...polylineFields };
    const polygon = { id: 'area', coordinates: AREA, ...polygonFields };
    const circle = { id: 'zone', center: WARSAW, radius: 250, ...circleFields };

    expect(normalizePolylineDescriptors([polyline])).toEqual([polyline]);
    expect(normalizePolygonDescriptors([polygon])).toEqual([polygon]);
    expect(normalizeCircleDescriptors([circle])).toEqual([circle]);
  });

  test('markers keep every field, as a child or in the bulk prop', () => {
    const expected: NativeMarkerDescriptor = {
      id: 'pin',
      coordinate: WARSAW,
      ...markerFields,
      enteringAnimation: { kind: 'fade', ...animationFields },
    };

    expect(
      collectChild(
        createElement(Marker, { coordinate: WARSAW, ...markerPropsFields }),
      ),
    ).toEqual([expected]);
    expect(
      normalizeMarkerDescriptors([
        { id: 'pin', coordinate: WARSAW, ...markerFields },
      ]),
    ).toEqual([expected]);
  });
});
