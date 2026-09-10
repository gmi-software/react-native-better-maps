import { describe, expect, mock, test } from 'bun:test';
import { deepDiffer } from '../app/deepDiffer';
import {
  generateMarkers,
  moveFirstMarkers,
  moveMarkerFraction,
  moveMarkers,
} from '../fixtures';
import { SIZES, measure, report, type Measurement } from './lib/bench';

// `normalizeMarkerDescriptors` reaches `Image.resolveAssetSource`; stub the
// React Native import so the library module loads under bun.
mock.module('react-native', () => ({
  Image: {
    resolveAssetSource: (source: unknown) =>
      typeof source === 'number'
        ? { uri: `asset:/${source}.png`, width: 32, height: 32, scale: 2 }
        : source,
  },
  Platform: {
    OS: 'ios',
    select: (options: Record<string, unknown>) =>
      options.ios ?? options.default,
  },
}));

const { normalizeMarkerDescriptors } =
  await import('../../package/src/overlays/normalizeMarkerDescriptors');

/**
 * The JS side of a marker update, isolated from React and the device:
 * what the library does to the `markers` prop before Nitro parses it, and
 * what Fabric's deep prop diff costs on the same arrays.
 */
describe('serialization micro-benchmarks', () => {
  test('marker arrays', () => {
    const generate: Measurement[] = [];
    const normalizeFirst: Measurement[] = [];
    const normalizeUnchanged: Measurement[] = [];
    const normalizeAfterOneChange: Measurement[] = [];
    const diffFirstChanged: Measurement[] = [];
    const diffLastChanged: Measurement[] = [];
    const diffNoChange: Measurement[] = [];
    const diffSameReference: Measurement[] = [];
    const mutateOnePercent: Measurement[] = [];
    const stringify: Measurement[] = [];

    for (const n of SIZES) {
      const markers = generateMarkers(n);
      const changedOne = moveFirstMarkers(markers, 1, 1);
      const changedLast = moveMarkers(markers, [n - 1], 1);
      const sameObjectsNewArray = markers.slice();
      const json = JSON.stringify(markers);
      generate.push(
        measure('generateMarkers', n, () => generateMarkers(n, { seed: 7 })),
      );
      normalizeFirst.push(
        measure('normalize (new array)', n, () =>
          normalizeMarkerDescriptors(markers.slice()),
        ),
      );
      normalizeUnchanged.push(
        measure('normalize (same objects)', n, () =>
          normalizeMarkerDescriptors(markers),
        ),
      );
      normalizeAfterOneChange.push(
        measure('normalize (1 changed)', n, () =>
          normalizeMarkerDescriptors(changedOne),
        ),
      );
      diffFirstChanged.push(
        measure('deepDiffer first changed', n, () =>
          deepDiffer(markers, changedOne),
        ),
      );
      diffLastChanged.push(
        measure('deepDiffer last changed', n, () =>
          deepDiffer(markers, changedLast),
        ),
      );
      diffNoChange.push(
        measure('deepDiffer new array, same objects', n, () =>
          deepDiffer(markers, sameObjectsNewArray),
        ),
      );
      diffSameReference.push(
        measure('deepDiffer same ref', n, () => deepDiffer(markers, markers)),
      );
      mutateOnePercent.push(
        measure('moveMarkerFraction 1%', n, () =>
          moveMarkerFraction(markers, 0.01, 2),
        ),
      );
      stringify.push(
        measure('JSON.stringify', n, () => JSON.stringify(markers), {
          iterations: 3,
          extra: {
            bytes: json.length,
            bytesPerMarker: Math.round(json.length / n),
          },
        }),
      );
      expect(deepDiffer(markers, changedOne)).toBe(true);
      expect(deepDiffer(markers, changedLast)).toBe(true);
      expect(deepDiffer(markers, sameObjectsNewArray)).toBe(false);
      expect(deepDiffer(markers, markers)).toBe(false);
    }

    report('serialization', {
      'fixture generation': generate,
      'normalizeMarkerDescriptors, fresh array of same objects': normalizeFirst,
      'normalizeMarkerDescriptors, unchanged reference': normalizeUnchanged,
      'normalizeMarkerDescriptors, one marker changed': normalizeAfterOneChange,
      'Fabric deepDiffer, first marker changed (early exit)': diffFirstChanged,
      'Fabric deepDiffer, last marker changed (walks all, then exits)':
        diffLastChanged,
      'Fabric deepDiffer, new array of the same objects (walks all, no exit)':
        diffNoChange,
      'Fabric deepDiffer, same reference (fast path)': diffSameReference,
      'immutable 1% mutation (app-side cost)': mutateOnePercent,
      'JSON payload size (stringify; bytes = wire-equivalent size)': stringify,
    });
  });
});
