import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { warnOverlay } from '../warnOverlay';

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
});

afterEach(() => {
  warnSpy.mockClear();
  restoreDevFlag();
});

describe('warnOverlay', () => {
  test('warns when __DEV__ is true', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;

    warnOverlay('hello');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('hello');
  });

  test('stays silent when __DEV__ is false', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    warnOverlay('hello');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('stays silent when __DEV__ is missing', () => {
    delete (globalThis as { __DEV__?: boolean }).__DEV__;

    warnOverlay('hello');

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
