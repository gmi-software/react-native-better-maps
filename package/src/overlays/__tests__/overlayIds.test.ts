import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  claimOverlayId,
  createOverlayIdState,
  createPositionalIdTracker,
  reserveOverlayId,
  trackPositionalIds,
  type OverlayIdCounts,
} from '../overlayIds';

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

function warnings(): string[] {
  return warnSpy.mock.calls.map((call) => String(call[0]));
}

describe('claimOverlayId', () => {
  test('prefers the id prop to the key', () => {
    const ids = createOverlayIdState();

    expect(claimOverlayId(ids, 'marker', 'pin', 'stop-b')).toBe('pin');
  });

  test('falls back to the key, then to a position that counts only overlays with neither', () => {
    const ids = createOverlayIdState();

    expect(claimOverlayId(ids, 'marker', undefined, 'a')).toBe('a');
    expect(claimOverlayId(ids, 'marker', undefined, null)).toBe('marker-0');
    expect(claimOverlayId(ids, 'marker', 'pin', null)).toBe('pin');
    expect(claimOverlayId(ids, 'marker', undefined, 'b')).toBe('b');
    expect(claimOverlayId(ids, 'marker', undefined, null)).toBe('marker-1');
    expect(ids.anonymous.marker).toBe(2);
  });

  test('treats an empty or null id and key as absent', () => {
    const ids = createOverlayIdState();

    expect(claimOverlayId(ids, 'polyline', '', 'route')).toBe('route');
    expect(claimOverlayId(ids, 'polyline', null, '')).toBe('polyline-0');
  });

  test('suffixes a key that another overlay has as its id prop, wherever that overlay comes', () => {
    const ids = createOverlayIdState();
    reserveOverlayId(ids, 'marker', 'home');

    expect(claimOverlayId(ids, 'marker', undefined, 'home')).toBe('home#2');
    expect(claimOverlayId(ids, 'marker', 'home', null)).toBe('home');
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain(
      'marker key "home" is already the id of another marker, so this one gets the id "home#2"',
    );
  });

  test('suffixes a key repeated in another list, in children order', () => {
    const ids = createOverlayIdState();

    expect(claimOverlayId(ids, 'marker', undefined, 'r1')).toBe('r1');
    expect(claimOverlayId(ids, 'marker', undefined, 'r1')).toBe('r1#2');
    expect(claimOverlayId(ids, 'marker', undefined, 'r1')).toBe('r1#3');
    expect(warnings()).toHaveLength(2);
  });

  test('skips a suffix that is taken too', () => {
    const ids = createOverlayIdState();
    reserveOverlayId(ids, 'circle', 'zone#2');

    expect(claimOverlayId(ids, 'circle', undefined, 'zone')).toBe('zone');
    expect(claimOverlayId(ids, 'circle', undefined, 'zone')).toBe('zone#3');
  });

  test('suffixes a position that an id prop already has', () => {
    const ids = createOverlayIdState();
    reserveOverlayId(ids, 'polygon', 'polygon-0');

    expect(claimOverlayId(ids, 'polygon', undefined, undefined)).toBe(
      'polygon-0#2',
    );
    expect(claimOverlayId(ids, 'polygon', 'polygon-0', undefined)).toBe(
      'polygon-0',
    );
    expect(warnings()[0]).toContain(
      'polygon "polygon-0" (no id or key) is already the id of another polygon',
    );
  });

  test('keeps a repeated id prop as given and reports it', () => {
    const ids = createOverlayIdState();
    reserveOverlayId(ids, 'marker', 'pin');
    reserveOverlayId(ids, 'marker', 'pin');

    expect(claimOverlayId(ids, 'marker', 'pin', 'a')).toBe('pin');
    expect(claimOverlayId(ids, 'marker', 'pin', 'b')).toBe('pin');
    expect(warnings()).toEqual([
      expect.stringContaining(
        'two markers have the id "pin", so only one of them is drawn',
      ),
    ]);
  });

  test('keeps each kind in a namespace of its own', () => {
    const ids = createOverlayIdState();

    expect(claimOverlayId(ids, 'marker', undefined, 'r1')).toBe('r1');
    expect(claimOverlayId(ids, 'polyline', undefined, 'r1')).toBe('r1');
    expect(claimOverlayId(ids, 'geojson', undefined, 'r1')).toBe('r1');
    expect(warnings()).toEqual([]);
  });
});

function counts(overrides: Partial<OverlayIdCounts>): OverlayIdCounts {
  return {
    marker: 0,
    polyline: 0,
    polygon: 0,
    circle: 0,
    geojson: 0,
    ...overrides,
  };
}

describe('trackPositionalIds', () => {
  test('stays silent on the first render', () => {
    const tracker = createPositionalIdTracker();

    trackPositionalIds(tracker, counts({ marker: 3 }));

    expect(warnings()).toEqual([]);
  });

  test('warns once per kind when overlays identified by position change in number and some stay', () => {
    const tracker = createPositionalIdTracker();

    trackPositionalIds(tracker, counts({ marker: 3, circle: 1 }));
    trackPositionalIds(tracker, counts({ marker: 2, circle: 1 }));
    trackPositionalIds(tracker, counts({ marker: 1, circle: 1 }));

    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain(
      'the number of markers with neither an id nor a key went from 3 to 2',
    );
  });

  test('stays silent when none were there before or none are left', () => {
    const tracker = createPositionalIdTracker();

    trackPositionalIds(tracker, counts({}));
    trackPositionalIds(tracker, counts({ polyline: 2 }));
    trackPositionalIds(tracker, counts({}));

    expect(warnings()).toEqual([]);
  });

  test('stays silent when the number does not change', () => {
    const tracker = createPositionalIdTracker();

    trackPositionalIds(tracker, counts({ geojson: 2 }));
    trackPositionalIds(tracker, counts({ geojson: 2 }));

    expect(warnings()).toEqual([]);
  });
});
