import { describe, expect, test } from 'bun:test';
import { MapViewCommands } from '../../native/mapViewCommands';
import {
  INVALID_REGION_ERROR,
  runWithValidRegion,
} from '../runWithValidRegion';

const validRegion = {
  latitude: 52.23,
  longitude: 21.01,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

describe('runWithValidRegion', () => {
  test('runs the call for a valid region', async () => {
    await expect(
      runWithValidRegion(validRegion, async () => 'moved'),
    ).resolves.toBe('moved');
  });

  test('rejects an invalid region without running the call', async () => {
    let didRun = false;

    await expect(
      runWithValidRegion({ ...validRegion, latitudeDelta: 0 }, async () => {
        didRun = true;
      }),
    ).rejects.toThrow(INVALID_REGION_ERROR);
    expect(didRun).toBe(false);
  });

  test('rejects without queueing the call for the native map', async () => {
    const commands = new MapViewCommands<string[]>();
    const reached: string[] = [];

    const pending = runWithValidRegion(
      { ...validRegion, latitude: Number.NaN },
      () =>
        commands.run(async (calls) => {
          calls.push('region');
        }),
    );
    // Had the call been buffered, the arriving handle would replay it.
    commands.attach(reached);

    await expect(pending).rejects.toThrow(INVALID_REGION_ERROR);
    expect(reached).toEqual([]);
  });

  test('leaves a span that runs past a pole to the map, which pulls it back', async () => {
    await expect(
      runWithValidRegion(
        { ...validRegion, latitude: 80, latitudeDelta: 40 },
        async () => 'moved',
      ),
    ).resolves.toBe('moved');
  });
});
