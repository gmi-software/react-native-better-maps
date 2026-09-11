import { describe, expect, test } from 'bun:test';
import { resolvePaintColor, resolveZIndex } from '../geojsonStyle';

describe('resolvePaintColor', () => {
  test('returns the fallback when the property is missing', () => {
    expect(resolvePaintColor(null, 'fill', '#007AFF')).toBe('#007AFF');
    expect(resolvePaintColor({ stroke: '#FF3B30' }, 'fill', '#007AFF')).toBe(
      '#007AFF',
    );
  });

  test('returns the color unchanged when opacity is absent', () => {
    expect(resolvePaintColor({ fill: '#34C75980' }, 'fill', undefined)).toBe(
      '#34C75980',
    );
  });

  test('applies feature opacity to the fallback color', () => {
    expect(resolvePaintColor({ 'fill-opacity': 0.25 }, 'fill', '#007AFF')).toBe(
      '#007AFF40',
    );
  });

  test('appends alpha to #RGB and #RRGGBB', () => {
    expect(
      resolvePaintColor({ fill: '#0F0', 'fill-opacity': 1 }, 'fill', undefined),
    ).toBe('#00FF00FF');
    expect(
      resolvePaintColor(
        { fill: '#34C759', 'fill-opacity': 0.25 },
        'fill',
        undefined,
      ),
    ).toBe('#34C75940');
  });

  test('replaces alpha on #RGBA and #RRGGBBAA', () => {
    expect(
      resolvePaintColor(
        { fill: '#0F08', 'fill-opacity': 0.25 },
        'fill',
        undefined,
      ),
    ).toBe('#00FF0040');
    expect(
      resolvePaintColor(
        { fill: '#34C75980', 'fill-opacity': 0.25 },
        'fill',
        undefined,
      ),
    ).toBe('#34C75940');
  });

  test('leaves non-hex colors unchanged', () => {
    expect(
      resolvePaintColor(
        { fill: 'red', 'fill-opacity': 0.25 },
        'fill',
        undefined,
      ),
    ).toBe('red');
  });
});

describe('resolveZIndex', () => {
  test('prefers a finite feature value over the fallback', () => {
    expect(resolveZIndex({ zIndex: 7 }, 2)).toBe(7);
    expect(resolveZIndex({ zIndex: '4' }, 2)).toBe(4);
  });

  test('uses the fallback when the feature value is invalid', () => {
    expect(resolveZIndex({ zIndex: 'top' }, 2)).toBe(2);
    expect(resolveZIndex(null, undefined)).toBeUndefined();
  });
});
