import { describe, expect, test } from 'bun:test';
import {
  isValidCoordinate,
  isValidCoordinateList,
  isValidRadius,
} from '../validateGeometry';

describe('geometry validation', () => {
  test('validates coordinate bounds and finite values', () => {
    expect(isValidCoordinate({ latitude: 90, longitude: 180 })).toBe(true);
    expect(isValidCoordinate({ latitude: -90, longitude: -180 })).toBe(true);
    expect(isValidCoordinate({ latitude: Number.NaN, longitude: 0 })).toBe(
      false,
    );
    expect(
      isValidCoordinate({ latitude: 0, longitude: Number.POSITIVE_INFINITY }),
    ).toBe(false);
    expect(isValidCoordinate({ latitude: 90.0001, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: -90.0001, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 180.0001 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: -180.0001 })).toBe(
      false,
    );
  });

  test('rejects sparse coordinate arrays', () => {
    expect(isValidCoordinateList(new Array(2), 2)).toBe(false);
  });

  test('requires the requested number of valid coordinates', () => {
    const coordinate = { latitude: 0, longitude: 0 };
    expect(isValidCoordinateList([], 2)).toBe(false);
    expect(isValidCoordinateList([coordinate], 2)).toBe(false);
    expect(isValidCoordinateList([coordinate, coordinate], 2)).toBe(true);
    expect(
      isValidCoordinateList(
        [coordinate, { latitude: Number.NaN, longitude: 0 }],
        2,
      ),
    ).toBe(false);
  });

  test('accepts zero radius and rejects invalid radii', () => {
    expect(isValidRadius(0)).toBe(true);
    expect(isValidRadius(1)).toBe(true);
    expect(isValidRadius(-1)).toBe(false);
    expect(isValidRadius(Number.NaN)).toBe(false);
    expect(isValidRadius(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
