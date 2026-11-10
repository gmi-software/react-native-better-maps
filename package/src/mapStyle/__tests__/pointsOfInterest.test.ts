import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  googlePoiStyleRules,
  pointsOfInterestEqual,
  resolveGoogleMapStyle,
  toApplePoiFilter,
} from '../pointsOfInterest';

const warnSpy = spyOn(console, 'warn');
const globalDev = globalThis as { __DEV__?: boolean };
const previousDev = globalDev.__DEV__;

beforeEach(() => {
  warnSpy.mockClear();
  globalDev.__DEV__ = true;
});

afterEach(() => {
  warnSpy.mockClear();
  if (previousDev === undefined) {
    delete globalDev.__DEV__;
  } else {
    globalDev.__DEV__ = previousDev;
  }
});

const off = (featureType: string) => ({
  featureType,
  stylers: [{ visibility: 'off' as const }],
});
const on = (featureType: string) => ({
  featureType,
  stylers: [{ visibility: 'on' as const }],
});

describe('googlePoiStyleRules', () => {
  test('adds no rules for the provider default', () => {
    expect(googlePoiStyleRules(undefined)).toEqual([]);
    expect(googlePoiStyleRules('all')).toEqual([]);
  });

  test('turns every POI off for none', () => {
    expect(googlePoiStyleRules('none')).toEqual([off('poi')]);
  });

  test('turns off the group of each excluded category, once', () => {
    expect(
      googlePoiStyleRules({ exclude: ['restaurant', 'store', 'museum'] }),
    ).toEqual([off('poi.business'), off('poi.attraction')]);
  });

  test('turns every POI off, then the included groups back on', () => {
    expect(googlePoiStyleRules({ include: ['park', 'hospital'] })).toEqual([
      off('poi'),
      on('poi.park'),
      on('poi.medical'),
    ]);
  });

  test('ignores excluded categories that have no Google group', () => {
    expect(googlePoiStyleRules({ exclude: ['airport', 'beach'] })).toEqual([]);
  });

  test('leaves included categories without a Google group hidden', () => {
    expect(googlePoiStyleRules({ include: ['parking'] })).toEqual([off('poi')]);
  });

  test('maps every Google POI group', () => {
    expect(
      googlePoiStyleRules({
        exclude: [
          'zoo',
          'cafe',
          'postOffice',
          'pharmacy',
          'playground',
          'religiousSite',
          'university',
          'stadium',
        ],
      }),
    ).toEqual([
      off('poi.attraction'),
      off('poi.business'),
      off('poi.government'),
      off('poi.medical'),
      off('poi.park'),
      off('poi.place_of_worship'),
      off('poi.school'),
      off('poi.sports_complex'),
    ]);
  });
});

describe('resolveGoogleMapStyle', () => {
  test('passes customMapStyle through untouched without generated rules', () => {
    const customMapStyle = '[ {"featureType":"road","stylers":[]} ]';
    expect(resolveGoogleMapStyle(undefined, customMapStyle, undefined)).toBe(
      customMapStyle,
    );
    expect(resolveGoogleMapStyle('all', undefined, undefined)).toBeUndefined();
  });

  test('puts the generated rules before the custom ones, so custom rules win', () => {
    const customRule = on('poi.park');
    const style = resolveGoogleMapStyle(
      'none',
      JSON.stringify([customRule]),
      undefined,
    );
    expect(JSON.parse(style ?? '')).toEqual([off('poi'), customRule]);
  });

  test('uses only the generated rules without a customMapStyle', () => {
    expect(resolveGoogleMapStyle('none', undefined, undefined)).toBe(
      JSON.stringify([off('poi')]),
    );
    expect(resolveGoogleMapStyle('none', '  ', undefined)).toBe(
      JSON.stringify([off('poi')]),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('warns and keeps the generated rules when customMapStyle is not a rule array', () => {
    expect(resolveGoogleMapStyle('none', '{not json', undefined)).toBe(
      JSON.stringify([off('poi')]),
    );
    expect(resolveGoogleMapStyle('none', '{}', undefined)).toBe(
      JSON.stringify([off('poi')]),
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  test('warns that a Google Map ID ignores the generated rules', () => {
    resolveGoogleMapStyle('none', undefined, 'map-id');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0])).toContain('googleMapId');
  });

  test('does not warn about a Google Map ID when nothing is generated', () => {
    resolveGoogleMapStyle('all', undefined, 'map-id');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('toApplePoiFilter', () => {
  test('keeps the provider default when omitted', () => {
    expect(toApplePoiFilter(undefined)).toBeUndefined();
  });

  test('converts each form of the prop', () => {
    expect(toApplePoiFilter('all')).toEqual({ mode: 'all', categories: [] });
    expect(toApplePoiFilter('none')).toEqual({ mode: 'none', categories: [] });
    expect(toApplePoiFilter({ include: ['park'] })).toEqual({
      mode: 'include',
      categories: ['park'],
    });
    expect(toApplePoiFilter({ exclude: ['restaurant', 'store'] })).toEqual({
      mode: 'exclude',
      categories: ['restaurant', 'store'],
    });
  });
});

describe('pointsOfInterestEqual', () => {
  test('compares filters by value', () => {
    expect(
      pointsOfInterestEqual({ exclude: ['store'] }, { exclude: ['store'] }),
    ).toBe(true);
    expect(pointsOfInterestEqual('none', 'none')).toBe(true);
    expect(pointsOfInterestEqual(undefined, undefined)).toBe(true);
  });

  test('tells different filters apart', () => {
    expect(
      pointsOfInterestEqual({ exclude: ['store'] }, { include: ['store'] }),
    ).toBe(false);
    expect(
      pointsOfInterestEqual({ exclude: ['store'] }, { exclude: ['cafe'] }),
    ).toBe(false);
    expect(pointsOfInterestEqual({ exclude: ['store'] }, { exclude: [] })).toBe(
      false,
    );
    expect(pointsOfInterestEqual('all', undefined)).toBe(false);
    expect(pointsOfInterestEqual('none', { exclude: [] })).toBe(false);
  });
});
