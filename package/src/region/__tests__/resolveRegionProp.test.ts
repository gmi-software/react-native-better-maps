import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { resolveRegionProp } from '../resolveRegionProp';

const warnSpy = spyOn(console, 'warn');
const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;

const validRegion = {
  latitude: 52.23,
  longitude: 21.01,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

function restoreDevFlag(): void {
  const globalDev = globalThis as { __DEV__?: boolean };
  if (previousDev === undefined) {
    delete globalDev.__DEV__;
    return;
  }

  globalDev.__DEV__ = previousDev;
}

beforeEach(() => {
  warnSpy.mockClear();
});

afterEach(() => {
  warnSpy.mockClear();
  restoreDevFlag();
});

describe('resolveRegionProp', () => {
  test('passes a valid region through unchanged', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(resolveRegionProp(validRegion, undefined)).toBe(validRegion);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('leaves a missing region alone without warning', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(resolveRegionProp(undefined, undefined)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('holds the last accepted region when the prop is unset', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    // `region={enabled ? region : undefined}` on a mounted view: unsetting it
    // reaches the native view as `null`, which throws in the struct converter.
    expect(resolveRegionProp(undefined, validRegion)).toBe(validRegion);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('drops an invalid region and warns in development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(
      resolveRegionProp({ ...validRegion, latitude: Number.NaN }, undefined),
    ).toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('region ignored');
  });

  test('holds the last accepted region instead of unsetting the prop', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    // Unsetting it would reach the native view as `null`, which the generated
    // struct converter rejects before any native guard runs.
    expect(
      resolveRegionProp({ ...validRegion, latitude: Number.NaN }, validRegion),
    ).toBe(validRegion);
  });

  test('drops an invalid region silently outside development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(
      resolveRegionProp({ ...validRegion, latitude: 1000 }, undefined),
    ).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
