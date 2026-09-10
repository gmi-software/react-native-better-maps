import { describe, expect, test } from 'bun:test';
import {
  generateMarkers,
  generatePolygonCoordinates,
  generatePolylineCoordinates,
  hashJson,
  moveMarkerFraction,
  pickIndices,
} from '..';

/**
 * Pins the fixture generators: if a hash changes, every recorded baseline
 * stops being comparable with new runs. Update these values only together
 * with a note in performance/PERFORMANCE.md and a fresh baseline.
 */
const EXPECTED_HASHES: Record<string, string> = {
  'markers-100': '475809674c821543',
  'markers-1000': '01a979007e9ffb51',
  'markers-10000': '2187483cc1a0994e',
  'markers-1000-titles-rich': 'dae84dc6398d6f51',
  'polyline-1000': 'b030f609e16e08f6',
  'polygon-1000': 'a3e49454179a3bc8',
  'update-1pct-10000': '7f8d79c8b8bbd359',
};

describe('fixtures are deterministic', () => {
  test('the same call yields identical data', () => {
    expect(generateMarkers(500)).toEqual(generateMarkers(500));
    expect(generatePolylineCoordinates(500)).toEqual(
      generatePolylineCoordinates(500),
    );
    expect(generatePolygonCoordinates(500)).toEqual(
      generatePolygonCoordinates(500),
    );
  });

  test('seeds change the data', () => {
    expect(generateMarkers(100, { seed: 1 })).not.toEqual(
      generateMarkers(100, { seed: 2 }),
    );
  });

  test('markers stay inside Poland', () => {
    for (const marker of generateMarkers(2000)) {
      expect(marker.coordinate.latitude).toBeGreaterThanOrEqual(49.002);
      expect(marker.coordinate.latitude).toBeLessThanOrEqual(54.835);
      expect(marker.coordinate.longitude).toBeGreaterThanOrEqual(14.123);
      expect(marker.coordinate.longitude).toBeLessThanOrEqual(24.145);
    }
  });

  test('mutations only replace the touched objects', () => {
    const base = generateMarkers(1000);
    const next = moveMarkerFraction(base, 0.01, 1);
    let changed = 0;
    for (let index = 0; index < base.length; index += 1) {
      if (base[index] !== next[index]) {
        changed += 1;
      }
    }
    expect(changed).toBe(10);
    expect(pickIndices(1000, 10)).toEqual(pickIndices(1000, 10));
  });

  test('pinned hashes', () => {
    const actual: Record<string, string> = {
      'markers-100': hashJson(generateMarkers(100)),
      'markers-1000': hashJson(generateMarkers(1000)),
      'markers-10000': hashJson(generateMarkers(10_000)),
      'markers-1000-titles-rich': hashJson(
        generateMarkers(1000, { withTitles: true, rich: true }),
      ),
      'polyline-1000': hashJson(generatePolylineCoordinates(1000)),
      'polygon-1000': hashJson(generatePolygonCoordinates(1000)),
      'update-1pct-10000': hashJson(
        moveMarkerFraction(generateMarkers(10_000), 0.01, 3),
      ),
    };
    expect(actual).toEqual(EXPECTED_HASHES);
  });
});
