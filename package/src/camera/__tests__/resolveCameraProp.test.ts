import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { resolveCameraProp } from '../resolveCameraProp';

const warnSpy = spyOn(console, 'warn');
const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;

const validCamera = {
  center: { latitude: 52.23, longitude: 21.01 },
  zoom: 12,
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

describe('resolveCameraProp', () => {
  test('passes a valid camera through unchanged', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(resolveCameraProp(validCamera, undefined)).toBe(validCamera);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('leaves a missing camera alone without warning', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(resolveCameraProp(undefined, undefined)).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('holds the last accepted camera when the prop is unset', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    // `camera={following ? camera : undefined}` on a mounted view: unsetting it
    // reaches the native view as `null`, which throws in the struct converter.
    expect(resolveCameraProp(undefined, validCamera)).toBe(validCamera);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('drops an invalid camera and warns in development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    expect(
      resolveCameraProp(
        { center: { latitude: Number.NaN, longitude: Number.NaN } },
        undefined,
      ),
    ).toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('camera ignored');
  });

  test('holds the last accepted camera instead of unsetting the prop', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    // Unsetting it would reach the native view as `null`, which the generated
    // struct converter rejects before any native guard runs.
    expect(
      resolveCameraProp({ ...validCamera, pitch: Number.NaN }, validCamera),
    ).toBe(validCamera);
  });

  test('drops an invalid camera silently outside development', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    expect(
      resolveCameraProp(
        { center: { latitude: 1000, longitude: 0 } },
        undefined,
      ),
    ).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
