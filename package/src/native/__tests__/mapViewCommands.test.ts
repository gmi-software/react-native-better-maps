import { describe, expect, test } from 'bun:test';
import {
  MAP_VIEW_NOT_MOUNTED_ERROR,
  MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR,
  MapViewCommands,
} from '../mapViewCommands';

interface FakeHybrid {
  calls: string[];
}

function fakeHybrid(): FakeHybrid {
  return { calls: [] };
}

function record(name: string) {
  return async (target: FakeHybrid): Promise<string> => {
    target.calls.push(name);
    return name;
  };
}

describe('MapViewCommands', () => {
  test('runs against the handle once it is attached', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();
    commands.attach(target);

    await expect(commands.run(record('fit'))).resolves.toBe('fit');
    expect(target.calls).toEqual(['fit']);
  });

  test('buffers calls made before the handle arrives', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    const pending = commands.run(record('fit'));
    expect(target.calls).toEqual([]);

    commands.attach(target);

    await expect(pending).resolves.toBe('fit');
    expect(target.calls).toEqual(['fit']);
  });

  test('replays buffered calls in the order they were made', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    const results = Promise.all([
      commands.run(record('first')),
      commands.run(record('second')),
      commands.run(record('third')),
    ]);

    commands.attach(target);

    await expect(results).resolves.toEqual(['first', 'second', 'third']);
    expect(target.calls).toEqual(['first', 'second', 'third']);
  });

  test('propagates a rejection from a buffered command', async () => {
    const commands = new MapViewCommands<FakeHybrid>();

    const pending = commands.run(async () => {
      throw new Error('native failure');
    });

    commands.attach(fakeHybrid());

    await expect(pending).rejects.toThrow('native failure');
  });

  test('settles the whole buffer when one command throws instead of rejecting', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    const throwing = commands.run(() => {
      throw new Error('nitro argument conversion failed');
    });
    const behind = commands.run(record('behind'));

    commands.attach(target);

    await expect(throwing).rejects.toThrow('nitro argument conversion failed');
    await expect(behind).resolves.toBe('behind');
    expect(target.calls).toEqual(['behind']);
  });

  test('replaces a stale handle when a second one is attached', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const stale = fakeHybrid();
    const fresh = fakeHybrid();

    commands.attach(stale);
    commands.attach(fresh);

    await expect(commands.run(record('fit'))).resolves.toBe('fit');
    expect(stale.calls).toEqual([]);
    expect(fresh.calls).toEqual(['fit']);
  });

  test('rejects buffered calls when the view unmounts first', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    const pending = commands.run(record('fit'));
    commands.unmount();

    await expect(pending).rejects.toThrow(
      MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR,
    );
    expect(target.calls).toEqual([]);
  });

  test('never touches the handle for a call cancelled at unmount', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    const pending = commands.run(record('fit'));
    commands.unmount();
    await expect(pending).rejects.toThrow(
      MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR,
    );

    commands.attach(target);

    expect(target.calls).toEqual([]);
  });

  test('rejects calls made after unmount', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();
    commands.attach(target);
    commands.unmount();

    await expect(commands.run(record('fit'))).rejects.toThrow(
      MAP_VIEW_NOT_MOUNTED_ERROR,
    );
    expect(target.calls).toEqual([]);
  });

  test('keeps working through a StrictMode unmount/mount cycle', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    const discarded = commands.run(record('discarded'));
    commands.unmount();
    commands.mount();

    const kept = commands.run(record('kept'));
    commands.attach(target);

    await expect(discarded).rejects.toThrow(
      MAP_VIEW_UNMOUNTED_BEFORE_READY_ERROR,
    );
    await expect(kept).resolves.toBe('kept');
    expect(target.calls).toEqual(['kept']);
  });

  test('keeps the handle when the effect is re-run after attaching', async () => {
    const commands = new MapViewCommands<FakeHybrid>();
    const target = fakeHybrid();

    commands.attach(target);
    commands.unmount();
    commands.mount();

    await expect(commands.run(record('fit'))).resolves.toBe('fit');
    expect(target.calls).toEqual(['fit']);
  });
});
