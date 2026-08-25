import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { parseGeojsonFeatures } from '../parseGeojson';
import type {
  GeojsonFeatureCollection,
  GeojsonPolygon,
} from '../../types/geojson';

const warnSpy = spyOn(console, 'warn');

beforeEach(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  warnSpy.mockClear();
});

describe('parseGeojsonFeatures', () => {
  test('parses a FeatureCollection', () => {
    const collection: GeojsonFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 'hub',
          properties: { name: 'Hub' },
          geometry: {
            type: 'Point',
            coordinates: [21.0122, 52.2297],
          },
        },
      ],
    };

    const features = parseGeojsonFeatures(collection);

    expect(features).toHaveLength(1);
    expect(features[0]?.id).toBe('hub');
    expect(features[0]?.geometry?.type).toBe('Point');
  });

  test('parses a JSON string', () => {
    const features = parseGeojsonFeatures(
      JSON.stringify({
        type: 'Feature',
        properties: null,
        geometry: { type: 'Point', coordinates: [21, 52] },
      }),
    );

    expect(features).toHaveLength(1);
    expect(features[0]?.geometry?.type).toBe('Point');
  });

  test('wraps a bare geometry as a Feature', () => {
    const polygon: GeojsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [21, 52],
          [21.01, 52],
          [21.01, 52.01],
          [21, 52.01],
          [21, 52],
        ],
      ],
    };

    const features = parseGeojsonFeatures(polygon);

    expect(features).toHaveLength(1);
    expect(features[0]?.properties).toBeNull();
    expect(features[0]?.geometry?.type).toBe('Polygon');
  });

  test('returns an empty list for invalid JSON', () => {
    const features = parseGeojsonFeatures('{not-json');

    expect(features).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('returns an empty list for an unknown type', () => {
    const features = parseGeojsonFeatures({ type: 'TopoJSON' });

    expect(features).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('skips invalid features in a FeatureCollection', () => {
    const features = parseGeojsonFeatures({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: null, geometry: { type: 'Nope' } },
        {
          type: 'Feature',
          properties: { name: 'ok' },
          geometry: { type: 'Point', coordinates: [21, 52] },
        },
      ],
    });

    expect(features).toHaveLength(1);
    expect(features[0]?.properties).toEqual({ name: 'ok' });
  });

  test('rejects invalid coordinates at the parser boundary', () => {
    const features = parseGeojsonFeatures({
      type: 'Feature',
      properties: null,
      geometry: { type: 'Point', coordinates: [21] },
    });

    expect(features).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  test('rejects a MultiGeometry when any member is invalid', () => {
    const features = parseGeojsonFeatures({
      type: 'Feature',
      properties: null,
      geometry: {
        type: 'MultiPoint',
        coordinates: [[21, 52], [21]],
      },
    });

    expect(features).toEqual([]);
  });

  test('preserves a valid source Feature', () => {
    const source: GeojsonFeatureCollection['features'][number] = {
      type: 'Feature',
      id: 'source',
      properties: { name: 'Source' },
      geometry: {
        type: 'Point',
        coordinates: [21, 52, 10],
      },
    };

    const features = parseGeojsonFeatures(source);

    expect(features[0]).toBe(source);
  });
});
