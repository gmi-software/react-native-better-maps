import { describe, expect, test } from 'bun:test';
import type { MarkerDescriptor } from '../../native/specs/overlays';
import {
  MARKER_BATCH_HEADER_BYTES,
  MARKER_BATCH_MAGIC,
  MarkerBatchWriter,
  POSITION_RECORD_BYTES,
  REMOVE_RECORD_BYTES,
  UPSERT_RECORD_BYTES,
  decodeMarkerBatch,
} from '../markerBatch';

const full: MarkerDescriptor = {
  id: 'full',
  coordinate: { latitude: 52.2297, longitude: 21.0122 },
  title: 'Warsaw',
  subtitle: 'Capital',
  draggable: true,
  clusterable: false,
  image: {
    uri: 'https://example.com/pin.png',
    width: 32,
    height: 40,
    scale: 2,
  },
  anchor: { x: 0.5, y: 1 },
  centerOffset: { x: 4, y: -8 },
  rotation: 45,
  flat: true,
  opacity: 0.75,
  markerColor: '#FF9500',
  zIndex: 3,
  enteringAnimation: {
    kind: 'fade-scale',
    duration: 180,
    delay: 20,
    reduceMotion: 'never',
  },
};

const minimal: MarkerDescriptor = {
  id: 'minimal',
  coordinate: { latitude: -33.8688, longitude: 151.2093 },
};

describe('MarkerBatchWriter', () => {
  test('returns null when nothing was recorded', () => {
    expect(new MarkerBatchWriter().finish()).toBeNull();
  });

  test('lays records out behind the header in the documented order', () => {
    const writer = new MarkerBatchWriter();
    writer.upsert(3, minimal);
    writer.position(7, { latitude: 1, longitude: 2 });
    writer.remove(9);
    writer.upsert(4, minimal);
    const batch = writer.finish();

    expect(batch).not.toBeNull();
    expect(batch!.buffer.byteLength).toBe(
      MARKER_BATCH_HEADER_BYTES +
        2 * UPSERT_RECORD_BYTES +
        REMOVE_RECORD_BYTES +
        POSITION_RECORD_BYTES,
    );
    const view = new DataView(batch!.buffer);
    expect(view.getUint32(0, true)).toBe(MARKER_BATCH_MAGIC);
    expect(view.getUint32(4, true)).toBe(2);
    expect(view.getUint32(8, true)).toBe(1);
    expect(view.getUint32(12, true)).toBe(1);

    const decoded = decodeMarkerBatch(batch!);
    expect(decoded.upserts.map((upsert) => upsert.handle)).toEqual([3, 4]);
    expect(decoded.removes).toEqual([9]);
    expect(decoded.positions).toEqual([
      { handle: 7, coordinate: { latitude: 1, longitude: 2 } },
    ]);
  });

  test('round-trips every field of a full descriptor', () => {
    const writer = new MarkerBatchWriter();
    writer.upsert(0, full);
    const decoded = decodeMarkerBatch(writer.finish()!);

    expect(decoded.upserts).toHaveLength(1);
    const { descriptor } = decoded.upserts[0];
    expect(descriptor.id).toBe('full');
    expect(descriptor.coordinate).toEqual(full.coordinate);
    expect(descriptor.title).toBe('Warsaw');
    expect(descriptor.subtitle).toBe('Capital');
    expect(descriptor.draggable).toBe(true);
    expect(descriptor.clusterable).toBe(false);
    expect(descriptor.image).toEqual(full.image);
    expect(descriptor.anchor).toEqual({ x: 0.5, y: 1 });
    expect(descriptor.centerOffset).toEqual({ x: 4, y: -8 });
    expect(descriptor.rotation).toBe(45);
    expect(descriptor.flat).toBe(true);
    expect(descriptor.opacity).toBeCloseTo(0.75, 6);
    expect(descriptor.enteringAnimation).toEqual(full.enteringAnimation);
  });

  test('keeps absent optionals absent', () => {
    const writer = new MarkerBatchWriter();
    writer.upsert(1, minimal);
    const { descriptor } = decodeMarkerBatch(writer.finish()!).upserts[0];

    expect(descriptor.title).toBeUndefined();
    expect(descriptor.subtitle).toBeUndefined();
    expect(descriptor.image).toBeUndefined();
    expect(descriptor.anchor).toBeUndefined();
    expect(descriptor.centerOffset).toBeUndefined();
    expect(descriptor.rotation).toBeUndefined();
    expect(descriptor.opacity).toBeUndefined();
    expect(descriptor.enteringAnimation).toBeUndefined();
    expect(descriptor.draggable).toBeUndefined();
    expect(descriptor.clusterable).toBeUndefined();
    expect(descriptor.flat).toBeUndefined();
  });

  test('distinguishes zero from absent for floats and points', () => {
    const writer = new MarkerBatchWriter();
    writer.upsert(1, {
      ...minimal,
      rotation: 0,
      opacity: 0,
      anchor: { x: 0, y: 0 },
      image: { uri: 'asset:/pin.png' },
      enteringAnimation: { kind: 'fade', duration: 0 },
    });
    const { descriptor } = decodeMarkerBatch(writer.finish()!).upserts[0];

    expect(descriptor.rotation).toBe(0);
    expect(descriptor.opacity).toBe(0);
    expect(descriptor.anchor).toEqual({ x: 0, y: 0 });
    expect(descriptor.image).toEqual({
      uri: 'asset:/pin.png',
      width: undefined,
      height: undefined,
      scale: undefined,
    });
    expect(descriptor.enteringAnimation).toEqual({
      kind: 'fade',
      duration: 0,
      delay: undefined,
      reduceMotion: undefined,
    });
  });

  test('sends each distinct string once', () => {
    const writer = new MarkerBatchWriter();
    writer.upsert(0, {
      ...minimal,
      id: 'a',
      title: 'Shared',
      image: { uri: 'asset:/pin.png' },
    });
    writer.upsert(1, {
      ...minimal,
      id: 'b',
      title: 'Shared',
      image: { uri: 'asset:/pin.png' },
    });
    const batch = writer.finish()!;

    expect(batch.strings).toEqual(['a', 'Shared', 'asset:/pin.png', 'b']);
    const decoded = decodeMarkerBatch(batch);
    expect(decoded.upserts[1].descriptor.title).toBe('Shared');
    expect(decoded.upserts[1].descriptor.image?.uri).toBe('asset:/pin.png');
  });

  test('grows past its initial capacity', () => {
    const writer = new MarkerBatchWriter();
    const count = 1_000;
    for (let index = 0; index < count; index += 1) {
      writer.upsert(index, { ...minimal, id: `m-${index}` });
      writer.position(index, { latitude: index, longitude: -index });
    }
    const decoded = decodeMarkerBatch(writer.finish()!);

    expect(decoded.upserts).toHaveLength(count);
    expect(decoded.positions).toHaveLength(count);
    expect(decoded.upserts[count - 1].descriptor.id).toBe(`m-${count - 1}`);
    expect(decoded.positions[count - 1].coordinate).toEqual({
      latitude: count - 1,
      longitude: -(count - 1),
    });
  });

  test('rejects buffers that are not batches', () => {
    expect(() =>
      decodeMarkerBatch({
        buffer: new ArrayBuffer(16),
        strings: [],
        upsertCount: 0,
        removeCount: 0,
        positionCount: 0,
      }),
    ).toThrow('Not a marker batch');
  });
});
