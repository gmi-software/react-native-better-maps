import { describe, expect, test } from 'bun:test';
import { isValidCamera } from '../isValidCamera';

const validCamera = {
  center: { latitude: 52.23, longitude: 21.01 },
  zoom: 12,
  heading: 90,
  pitch: 45,
  altitude: 1000,
};

describe('isValidCamera', () => {
  test('accepts a camera both SDKs can represent', () => {
    expect(isValidCamera(validCamera)).toBe(true);
    expect(isValidCamera({ center: { latitude: -90, longitude: 180 } })).toBe(
      true,
    );
  });

  test('accepts a camera that supplies no framing values', () => {
    expect(isValidCamera({ center: { latitude: 0, longitude: 0 } })).toBe(true);
  });

  test('rejects a missing camera', () => {
    expect(isValidCamera(undefined)).toBe(false);
  });

  test('rejects a non-finite center', () => {
    expect(
      isValidCamera({
        ...validCamera,
        center: { latitude: Number.NaN, longitude: Number.NaN },
      }),
    ).toBe(false);
    expect(
      isValidCamera({
        ...validCamera,
        center: { latitude: 0, longitude: Number.POSITIVE_INFINITY },
      }),
    ).toBe(false);
  });

  test('rejects a center outside the world', () => {
    expect(
      isValidCamera({
        ...validCamera,
        center: { latitude: 1000, longitude: 0 },
      }),
    ).toBe(false);
    expect(
      isValidCamera({
        ...validCamera,
        center: { latitude: 0, longitude: 181 },
      }),
    ).toBe(false);
  });

  test('rejects a non-finite framing value', () => {
    expect(isValidCamera({ ...validCamera, zoom: Number.NaN })).toBe(false);
    expect(
      isValidCamera({ ...validCamera, heading: Number.POSITIVE_INFINITY }),
    ).toBe(false);
    expect(isValidCamera({ ...validCamera, pitch: Number.NaN })).toBe(false);
    expect(
      isValidCamera({ ...validCamera, altitude: Number.NEGATIVE_INFINITY }),
    ).toBe(false);
  });

  // Android throws on a tilt past 90 and MapKit flattens it; both are handled
  // natively by clamping, so the camera itself stays usable.
  test('accepts a pitch outside the range the SDKs draw', () => {
    expect(isValidCamera({ ...validCamera, pitch: 120 })).toBe(true);
    expect(isValidCamera({ ...validCamera, pitch: -10 })).toBe(true);
  });

  // Zoom, and bearing on Android, are narrowed to a 32-bit float before the SDK
  // sees them, so a number past that range arrives as `Infinity` however finite
  // it is here.
  test('rejects a framing value that overflows a 32-bit float', () => {
    expect(isValidCamera({ ...validCamera, zoom: Number.MAX_VALUE })).toBe(
      false,
    );
    expect(isValidCamera({ ...validCamera, heading: -Number.MAX_VALUE })).toBe(
      false,
    );
    expect(isValidCamera({ ...validCamera, zoom: 3.4e38 })).toBe(true);
  });

  // Pitch and altitude stay 64-bit on both platforms - pitch is clamped before
  // it is narrowed, and altitude never reaches the Android camera at all.
  test('accepts a large pitch or altitude', () => {
    expect(isValidCamera({ ...validCamera, pitch: Number.MAX_VALUE })).toBe(
      true,
    );
    expect(isValidCamera({ ...validCamera, altitude: Number.MAX_VALUE })).toBe(
      true,
    );
  });
});
