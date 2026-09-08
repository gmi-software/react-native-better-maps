import { describe, expect, test } from 'bun:test';
import type { MarkerDescriptor } from '../../native/specs/overlays';
import { decodeMarkerBatch, type MarkerBatch } from '../markerBatch';
import { MarkerDeltaCompiler } from '../markerDeltaCompiler';

function marker(
  id: string,
  latitude = 1,
  longitude = 2,
  title?: string,
): MarkerDescriptor {
  return { id, coordinate: { latitude, longitude }, title };
}

function decoded(batch: MarkerBatch | null) {
  return batch == null ? null : decodeMarkerBatch(batch);
}

describe('MarkerDeltaCompiler', () => {
  test('set sends every marker the first time and nothing when repeated', () => {
    const compiler = new MarkerDeltaCompiler();
    const first = decoded(compiler.set([marker('a'), marker('b')]));

    expect(first?.upserts.map((upsert) => upsert.handle)).toEqual([0, 1]);
    expect(first?.removes).toEqual([]);
    expect(compiler.size).toBe(2);

    expect(compiler.set([marker('a'), marker('b')])).toBeNull();
    // A structurally equal rebuild is also a no-op.
    expect(compiler.set([marker('a', 1, 2), marker('b', 1, 2)])).toBeNull();
  });

  test('set sends only the changed markers', () => {
    const compiler = new MarkerDeltaCompiler();
    compiler.set([marker('a'), marker('b'), marker('c')]);
    const batch = decoded(
      compiler.set([marker('a'), marker('b', 5, 6), marker('c')]),
    );

    expect(batch?.upserts).toHaveLength(1);
    expect(batch?.upserts[0].handle).toBe(1);
    expect(batch?.upserts[0].descriptor.coordinate).toEqual({
      latitude: 5,
      longitude: 6,
    });
    expect(batch?.removes).toEqual([]);
  });

  test('set removes markers missing from the array and reuses their handles', () => {
    const compiler = new MarkerDeltaCompiler();
    compiler.set([marker('a'), marker('b'), marker('c')]);
    const removal = decoded(compiler.set([marker('a'), marker('c')]));

    expect(removal?.removes).toEqual([1]);
    expect(removal?.upserts).toEqual([]);
    expect(compiler.has('b')).toBe(false);

    const reuse = decoded(
      compiler.set([marker('a'), marker('c'), marker('d')]),
    );
    expect(reuse?.upserts.map((upsert) => upsert.handle)).toEqual([1]);
    expect(reuse?.upserts[0].descriptor.id).toBe('d');
  });

  test('set keeps the first descriptor when an id repeats', () => {
    const compiler = new MarkerDeltaCompiler();
    const batch = decoded(
      compiler.set([marker('a', 1, 1, 'first'), marker('a', 2, 2, 'second')]),
    );

    expect(batch?.upserts).toHaveLength(1);
    expect(batch?.upserts[0].descriptor.title).toBe('first');
    expect(compiler.size).toBe(1);
  });

  test('upsert adds and updates without removing', () => {
    const compiler = new MarkerDeltaCompiler();
    compiler.set([marker('a'), marker('b')]);
    const batch = decoded(compiler.upsert([marker('a', 9, 9), marker('c')]));

    expect(
      batch?.upserts.map((upsert) => [upsert.handle, upsert.descriptor.id]),
    ).toEqual([
      [0, 'a'],
      [2, 'c'],
    ]);
    expect(batch?.removes).toEqual([]);
    expect(compiler.ids()).toEqual(['a', 'b', 'c']);
    expect(compiler.upsert([marker('a', 9, 9)])).toBeNull();
  });

  test('remove ignores unknown ids', () => {
    const compiler = new MarkerDeltaCompiler();
    compiler.set([marker('a'), marker('b')]);

    expect(decoded(compiler.remove(['b', 'missing']))?.removes).toEqual([1]);
    expect(compiler.remove(['missing'])).toBeNull();
    expect(compiler.size).toBe(1);
  });

  test('updatePositions writes position records and updates the stored coordinate', () => {
    const compiler = new MarkerDeltaCompiler();
    compiler.set([marker('a'), marker('b')]);
    const batch = decoded(
      compiler.updatePositions([
        { id: 'a', coordinate: { latitude: 3, longitude: 4 } },
        { id: 'b', coordinate: { latitude: 1, longitude: 2 } },
        { id: 'missing', coordinate: { latitude: 0, longitude: 0 } },
      ]),
    );

    expect(batch?.positions).toEqual([
      { handle: 0, coordinate: { latitude: 3, longitude: 4 } },
    ]);
    expect(batch?.upserts).toEqual([]);
    expect(compiler.get('a')?.coordinate).toEqual({
      latitude: 3,
      longitude: 4,
    });
    // The moved marker is now equal to a matching descriptor, so `set` is quiet.
    expect(compiler.set([marker('a', 3, 4), marker('b')])).toBeNull();
  });

  test('clear forgets handles', () => {
    const compiler = new MarkerDeltaCompiler();
    compiler.set([marker('a'), marker('b')]);
    compiler.clear();

    expect(compiler.size).toBe(0);
    expect(decoded(compiler.set([marker('z')]))?.upserts[0].handle).toBe(0);
  });
});
