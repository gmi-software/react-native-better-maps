import { describe, expect, test } from 'bun:test';
import { MapViewCommands } from '../../native/mapViewCommands';
import {
  INVALID_COORDINATE_ERROR,
  INVALID_POINT_ERROR,
  runWithValidCoordinate,
  runWithValidPoint,
} from '../runWithValidInput';

describe('runWithValidCoordinate', () => {
  test('runs the call for a coordinate on the map', async () => {
    await expect(
      runWithValidCoordinate(
        { latitude: 52.23, longitude: 21.01 },
        async () => 'converted',
      ),
    ).resolves.toBe('converted');
  });

  test('rejects a coordinate outside the world without running the call', async () => {
    for (const coordinate of [
      { latitude: Number.NaN, longitude: 21.01 },
      { latitude: 52.23, longitude: Number.POSITIVE_INFINITY },
      { latitude: 100, longitude: 21.01 },
      { latitude: 52.23, longitude: 190 },
    ]) {
      let didRun = false;

      await expect(
        runWithValidCoordinate(coordinate, async () => {
          didRun = true;
        }),
      ).rejects.toThrow(INVALID_COORDINATE_ERROR);
      expect(didRun).toBe(false);
    }
  });

  test('rejects without queueing the call for the native map', async () => {
    const commands = new MapViewCommands<string[]>();
    const reached: string[] = [];

    const pending = runWithValidCoordinate(
      { latitude: Number.NaN, longitude: 0 },
      () =>
        commands.run(async (calls) => {
          calls.push('pointForCoordinate');
        }),
    );
    // Had the call been buffered, the arriving handle would replay it.
    commands.attach(reached);

    await expect(pending).rejects.toThrow(INVALID_COORDINATE_ERROR);
    expect(reached).toEqual([]);
  });
});

describe('runWithValidPoint', () => {
  test('runs the call for a point off the map view too', async () => {
    await expect(
      runWithValidPoint({ x: -40, y: 5000 }, async () => 'converted'),
    ).resolves.toBe('converted');
  });

  test('rejects a point that is not finite without running the call', async () => {
    for (const point of [
      { x: Number.NaN, y: 10 },
      { x: 10, y: Number.NEGATIVE_INFINITY },
    ]) {
      let didRun = false;

      await expect(
        runWithValidPoint(point, async () => {
          didRun = true;
        }),
      ).rejects.toThrow(INVALID_POINT_ERROR);
      expect(didRun).toBe(false);
    }
  });

  test('rejects without queueing the call for the native map', async () => {
    const commands = new MapViewCommands<string[]>();
    const reached: string[] = [];

    const pending = runWithValidPoint({ x: Number.NaN, y: 0 }, () =>
      commands.run(async (calls) => {
        calls.push('coordinateForPoint');
      }),
    );
    commands.attach(reached);

    await expect(pending).rejects.toThrow(INVALID_POINT_ERROR);
    expect(reached).toEqual([]);
  });
});
