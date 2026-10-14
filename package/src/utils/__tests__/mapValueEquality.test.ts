import { describe, expect, test } from 'bun:test';
import type { Camera } from '../../types/camera';
import type { EdgePadding, Region } from '../../types/region';
import {
  camerasEqual,
  edgePaddingsEqual,
  regionsEqual,
} from '../mapValueEquality';

type Change<Value> = [string, (base: Value) => Value];

function describeFieldCoverage<Value>(
  name: string,
  base: Value,
  valuesEqual: (left: Value | undefined, right: Value | undefined) => boolean,
  changes: Array<Change<Value>>,
) {
  describe(name, () => {
    test('treats a structural clone as equal', () => {
      expect(valuesEqual(base, structuredClone(base))).toBe(true);
    });

    test('treats the same reference as equal', () => {
      expect(valuesEqual(base, base)).toBe(true);
    });

    test('treats two undefined values as equal', () => {
      expect(valuesEqual(undefined, undefined)).toBe(true);
    });

    test('treats a value and undefined as different', () => {
      expect(valuesEqual(base, undefined)).toBe(false);
      expect(valuesEqual(undefined, base)).toBe(false);
    });

    for (const [field, change] of changes) {
      test(`detects a change to ${field}`, () => {
        expect(valuesEqual(base, change(base))).toBe(false);
      });
    }
  });
}

const baseRegion: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.1,
  longitudeDelta: 0.2,
};

describeFieldCoverage('regionsEqual', baseRegion, regionsEqual, [
  ['latitude', (r) => ({ ...r, latitude: 0 })],
  ['longitude', (r) => ({ ...r, longitude: 0 })],
  ['latitudeDelta', (r) => ({ ...r, latitudeDelta: 1 })],
  ['longitudeDelta', (r) => ({ ...r, longitudeDelta: 1 })],
]);

const baseCamera: Camera = {
  center: { latitude: 52.2297, longitude: 21.0122 },
  zoom: 12,
  heading: 30,
  pitch: 45,
  altitude: 1000,
};

describeFieldCoverage('camerasEqual', baseCamera, camerasEqual, [
  ['center.latitude', (c) => ({ ...c, center: { ...c.center, latitude: 0 } })],
  [
    'center.longitude',
    (c) => ({ ...c, center: { ...c.center, longitude: 0 } }),
  ],
  ['zoom', (c) => ({ ...c, zoom: 13 })],
  ['a cleared zoom', (c) => ({ ...c, zoom: undefined })],
  ['heading', (c) => ({ ...c, heading: 0 })],
  ['pitch', (c) => ({ ...c, pitch: 0 })],
  ['altitude', (c) => ({ ...c, altitude: 2000 })],
]);

const basePadding: EdgePadding = { top: 1, right: 2, bottom: 3, left: 4 };

describeFieldCoverage('edgePaddingsEqual', basePadding, edgePaddingsEqual, [
  ['top', (p) => ({ ...p, top: 0 })],
  ['right', (p) => ({ ...p, right: 0 })],
  ['bottom', (p) => ({ ...p, bottom: 0 })],
  ['left', (p) => ({ ...p, left: 0 })],
]);
