import { describe, expect, test } from 'bun:test';
import { MapViewCommands } from '../../native/mapViewCommands';
import {
  INVALID_CAMERA_ERROR,
  runWithValidCamera,
} from '../runWithValidCamera';

const validCamera = {
  center: { latitude: 52.23, longitude: 21.01 },
  zoom: 12,
};

describe('runWithValidCamera', () => {
  test('runs the call for a valid camera', async () => {
    await expect(
      runWithValidCamera(validCamera, async () => 'moved'),
    ).resolves.toBe('moved');
  });

  test('rejects an invalid camera without running the call', async () => {
    let didRun = false;

    await expect(
      runWithValidCamera(
        { center: { latitude: Number.NaN, longitude: 21.01 } },
        async () => {
          didRun = true;
        },
      ),
    ).rejects.toThrow(INVALID_CAMERA_ERROR);
    expect(didRun).toBe(false);
  });

  test('rejects without queueing the call for the native map', async () => {
    const commands = new MapViewCommands<string[]>();
    const reached: string[] = [];

    const pending = runWithValidCamera(
      { ...validCamera, zoom: Number.POSITIVE_INFINITY },
      () =>
        commands.run(async (calls) => {
          calls.push('camera');
        }),
    );
    // Had the call been buffered, the arriving handle would replay it.
    commands.attach(reached);

    await expect(pending).rejects.toThrow(INVALID_CAMERA_ERROR);
    expect(reached).toEqual([]);
  });

  test('leaves a finite pitch past 90 to the map, which clamps it', async () => {
    await expect(
      runWithValidCamera({ ...validCamera, pitch: 120 }, async () => 'moved'),
    ).resolves.toBe('moved');
  });
});
