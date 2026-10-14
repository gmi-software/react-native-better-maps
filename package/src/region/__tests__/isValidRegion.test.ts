import { describe, expect, test } from 'bun:test';
import { isValidRegion } from '../isValidRegion';

const validRegion = {
  latitude: 52.23,
  longitude: 21.01,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

describe('isValidRegion', () => {
  test('accepts a region both SDKs can represent', () => {
    expect(isValidRegion(validRegion)).toBe(true);
    expect(
      isValidRegion({
        latitude: 0,
        longitude: 180,
        latitudeDelta: 180,
        longitudeDelta: 360,
      }),
    ).toBe(true);
  });

  test('rejects a missing region', () => {
    expect(isValidRegion(undefined)).toBe(false);
  });

  test('rejects a non-finite center', () => {
    expect(isValidRegion({ ...validRegion, latitude: Number.NaN })).toBe(false);
    expect(
      isValidRegion({ ...validRegion, longitude: Number.POSITIVE_INFINITY }),
    ).toBe(false);
  });

  test('rejects a center outside the world', () => {
    expect(isValidRegion({ ...validRegion, latitude: 1000 })).toBe(false);
    expect(isValidRegion({ ...validRegion, latitude: -90.0001 })).toBe(false);
    expect(isValidRegion({ ...validRegion, longitude: 180.0001 })).toBe(false);
  });

  test('rejects deltas that do not span an area', () => {
    expect(isValidRegion({ ...validRegion, latitudeDelta: 0 })).toBe(false);
    expect(isValidRegion({ ...validRegion, longitudeDelta: -1 })).toBe(false);
    expect(isValidRegion({ ...validRegion, latitudeDelta: Number.NaN })).toBe(
      false,
    );
    expect(
      isValidRegion({
        ...validRegion,
        longitudeDelta: Number.POSITIVE_INFINITY,
      }),
    ).toBe(false);
  });
});
