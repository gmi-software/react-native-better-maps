import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { resolveFitCoordinates } from '../resolveFitCoordinates';

const warnSpy = spyOn(console, 'warn');
const previousDev = (globalThis as { __DEV__?: boolean }).__DEV__;

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
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

afterEach(() => {
  warnSpy.mockClear();
  restoreDevFlag();
});

describe('resolveFitCoordinates', () => {
  test('passes placeable coordinates through without warning', () => {
    const coordinates = [
      { latitude: 52.23, longitude: 21.01 },
      { latitude: 50.06, longitude: 19.94 },
    ];

    expect(resolveFitCoordinates(coordinates)).toEqual(coordinates);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('keeps the placeable coordinates and warns about the rest', () => {
    const good = { latitude: 52.23, longitude: 21.01 };

    const result = resolveFitCoordinates([
      good,
      { latitude: Number.NaN, longitude: 21.01 },
      { latitude: 1000, longitude: 0 },
    ]);

    expect(result).toEqual([good]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('2 coordinate(s)');
  });

  test('returns nothing when no coordinate can be placed', () => {
    expect(
      resolveFitCoordinates([{ latitude: Number.NaN, longitude: Number.NaN }]),
    ).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
