import type {
  MarkerDescriptor,
  OverlayEnteringAnimationDescriptor,
  OverlayEnteringAnimationKind,
  OverlayEnteringAnimationReduceMotion,
} from '../native/specs/overlays';
import type { Coordinate } from '../types/coordinate';

/**
 * Wire format between `MarkerCollection` (JS) and the native marker store.
 *
 * One batch is one `ArrayBuffer` plus a string table. Numbers are
 * little-endian and every record has a fixed size, so the native decoders are
 * a straight loop over offsets with no per-field branching:
 *
 * ```
 * header     16 bytes   magic u32 · upsertCount u32 · removeCount u32 · positionCount u32
 * upserts    96 bytes   see `UpsertOffset`
 * removes     4 bytes   handle u32
 * positions  24 bytes   handle u32 · padding u32 · latitude f64 · longitude f64
 * ```
 *
 * Strings (id, title, subtitle, image uri, marker color) are indices into the string table,
 * `-1` when absent; each distinct string is sent once per batch. Optional
 * floats are `NaN` when absent. Booleans and the presence of `anchor` and
 * `centerOffset` are bits in `flags`.
 *
 * The native side applies removals first, then upserts, then positions, so a
 * handle freed by a removal may be reused by an upsert in the same batch.
 *
 * Keep in sync with `MarkerBatchDecoder.swift` and `MarkerBatchDecoder.kt`.
 */
export const MARKER_BATCH_MAGIC = 0x4e4d4b31;
export const MARKER_BATCH_HEADER_BYTES = 16;
export const UPSERT_RECORD_BYTES = 96;
export const REMOVE_RECORD_BYTES = 4;
export const POSITION_RECORD_BYTES = 24;
export const NO_STRING = -1;

export const UpsertFlag = {
  hasAnchor: 1 << 0,
  hasCenterOffset: 1 << 1,
  draggable: 1 << 16,
  clusterable: 1 << 17,
  flat: 1 << 18,
} as const;

/** Byte offsets within an upsert record. */
export const UpsertOffset = {
  handle: 0,
  flags: 4,
  id: 8,
  title: 12,
  subtitle: 16,
  imageUri: 20,
  latitude: 24,
  longitude: 32,
  imageWidth: 40,
  imageHeight: 44,
  imageScale: 48,
  anchorX: 52,
  anchorY: 56,
  centerOffsetX: 60,
  centerOffsetY: 64,
  rotation: 68,
  opacity: 72,
  animationDuration: 76,
  animationDelay: 80,
  animationKind: 84,
  animationReduceMotion: 85,
  markerColor: 88,
  zIndex: 92,
} as const;

const ANIMATION_KINDS: OverlayEnteringAnimationKind[] = [
  'none',
  'system',
  'fade',
  'fade-scale',
];

const REDUCE_MOTION_VALUES: OverlayEnteringAnimationReduceMotion[] = [
  'system',
  'never',
];

function animationKindCode(kind: OverlayEnteringAnimationKind): number {
  return ANIMATION_KINDS.indexOf(kind) + 1;
}

function reduceMotionCode(
  value: OverlayEnteringAnimationReduceMotion | undefined,
): number {
  return value == null ? 0 : REDUCE_MOTION_VALUES.indexOf(value) + 1;
}

export interface MarkerBatch {
  buffer: ArrayBuffer;
  strings: string[];
  upsertCount: number;
  removeCount: number;
  positionCount: number;
}

/** Append-only byte buffer that doubles its capacity when a record does not fit. */
class RecordBuffer {
  private buffer: ArrayBuffer;
  private bytes: Uint8Array;
  view: DataView;
  length = 0;

  constructor(initialCapacity: number) {
    this.buffer = new ArrayBuffer(initialCapacity);
    this.bytes = new Uint8Array(this.buffer);
    this.view = new DataView(this.buffer);
  }

  /** Reserves `recordBytes` and returns the record's start offset. */
  reserve(recordBytes: number): number {
    const offset = this.length;
    const needed = offset + recordBytes;
    if (needed > this.buffer.byteLength) {
      const next = new ArrayBuffer(
        Math.max(needed, this.buffer.byteLength * 2),
      );
      new Uint8Array(next).set(this.bytes.subarray(0, this.length));
      this.buffer = next;
      this.bytes = new Uint8Array(next);
      this.view = new DataView(next);
    }
    this.length = needed;
    return offset;
  }

  copyInto(target: Uint8Array, offset: number): void {
    target.set(this.bytes.subarray(0, this.length), offset);
  }
}

/**
 * Builds one batch. Records are appended as they come; `finish()` lays them
 * out in the fixed order the header describes.
 */
export class MarkerBatchWriter {
  private readonly upserts = new RecordBuffer(UPSERT_RECORD_BYTES * 64);
  private readonly positions = new RecordBuffer(POSITION_RECORD_BYTES * 64);
  private readonly removes: number[] = [];
  private readonly strings: string[] = [];
  private readonly stringIndices = new Map<string, number>();
  private upsertCount = 0;
  private positionCount = 0;

  get isEmpty(): boolean {
    return (
      this.upsertCount === 0 &&
      this.removes.length === 0 &&
      this.positionCount === 0
    );
  }

  upsert(handle: number, descriptor: MarkerDescriptor): void {
    const base = this.upserts.reserve(UPSERT_RECORD_BYTES);
    const view = this.upserts.view;
    const image = descriptor.image;
    const anchor = descriptor.anchor;
    const centerOffset = descriptor.centerOffset;
    const animation = descriptor.enteringAnimation;

    let flags = 0;
    if (anchor != null) {
      flags |= UpsertFlag.hasAnchor;
    }
    if (centerOffset != null) {
      flags |= UpsertFlag.hasCenterOffset;
    }
    if (descriptor.draggable === true) {
      flags |= UpsertFlag.draggable;
    }
    if (descriptor.clusterable !== false) {
      flags |= UpsertFlag.clusterable;
    }
    if (descriptor.flat === true) {
      flags |= UpsertFlag.flat;
    }

    view.setUint32(base + UpsertOffset.handle, handle, true);
    view.setUint32(base + UpsertOffset.flags, flags >>> 0, true);
    view.setInt32(base + UpsertOffset.id, this.intern(descriptor.id), true);
    view.setInt32(
      base + UpsertOffset.title,
      this.internOptional(descriptor.title),
      true,
    );
    view.setInt32(
      base + UpsertOffset.subtitle,
      this.internOptional(descriptor.subtitle),
      true,
    );
    view.setInt32(
      base + UpsertOffset.imageUri,
      this.internOptional(image?.uri),
      true,
    );
    view.setFloat64(
      base + UpsertOffset.latitude,
      descriptor.coordinate.latitude,
      true,
    );
    view.setFloat64(
      base + UpsertOffset.longitude,
      descriptor.coordinate.longitude,
      true,
    );
    view.setFloat32(base + UpsertOffset.imageWidth, image?.width ?? NaN, true);
    view.setFloat32(
      base + UpsertOffset.imageHeight,
      image?.height ?? NaN,
      true,
    );
    view.setFloat32(base + UpsertOffset.imageScale, image?.scale ?? NaN, true);
    view.setFloat32(base + UpsertOffset.anchorX, anchor?.x ?? 0, true);
    view.setFloat32(base + UpsertOffset.anchorY, anchor?.y ?? 0, true);
    view.setFloat32(
      base + UpsertOffset.centerOffsetX,
      centerOffset?.x ?? 0,
      true,
    );
    view.setFloat32(
      base + UpsertOffset.centerOffsetY,
      centerOffset?.y ?? 0,
      true,
    );
    view.setFloat32(
      base + UpsertOffset.rotation,
      descriptor.rotation ?? NaN,
      true,
    );
    view.setFloat32(
      base + UpsertOffset.opacity,
      descriptor.opacity ?? NaN,
      true,
    );
    view.setFloat32(
      base + UpsertOffset.animationDuration,
      animation?.duration ?? NaN,
      true,
    );
    view.setFloat32(
      base + UpsertOffset.animationDelay,
      animation?.delay ?? NaN,
      true,
    );
    view.setUint8(
      base + UpsertOffset.animationKind,
      animation == null ? 0 : animationKindCode(animation.kind),
    );
    view.setUint8(
      base + UpsertOffset.animationReduceMotion,
      reduceMotionCode(animation?.reduceMotion),
    );
    view.setInt32(
      base + UpsertOffset.markerColor,
      this.internOptional(descriptor.markerColor),
      true,
    );
    view.setFloat32(base + UpsertOffset.zIndex, descriptor.zIndex ?? NaN, true);
    this.upsertCount += 1;
  }

  remove(handle: number): void {
    this.removes.push(handle);
  }

  position(handle: number, coordinate: Coordinate): void {
    const base = this.positions.reserve(POSITION_RECORD_BYTES);
    const view = this.positions.view;
    view.setUint32(base, handle, true);
    view.setUint32(base + 4, 0, true);
    view.setFloat64(base + 8, coordinate.latitude, true);
    view.setFloat64(base + 16, coordinate.longitude, true);
    this.positionCount += 1;
  }

  /** Returns the packed batch, or `null` when nothing was recorded. */
  finish(): MarkerBatch | null {
    if (this.isEmpty) {
      return null;
    }

    const removeBytes = this.removes.length * REMOVE_RECORD_BYTES;
    const total =
      MARKER_BATCH_HEADER_BYTES +
      this.upserts.length +
      removeBytes +
      this.positions.length;
    const buffer = new ArrayBuffer(total);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    view.setUint32(0, MARKER_BATCH_MAGIC, true);
    view.setUint32(4, this.upsertCount, true);
    view.setUint32(8, this.removes.length, true);
    view.setUint32(12, this.positionCount, true);

    let offset = MARKER_BATCH_HEADER_BYTES;
    this.upserts.copyInto(bytes, offset);
    offset += this.upserts.length;
    for (const handle of this.removes) {
      view.setUint32(offset, handle, true);
      offset += REMOVE_RECORD_BYTES;
    }
    this.positions.copyInto(bytes, offset);

    return {
      buffer,
      strings: this.strings,
      upsertCount: this.upsertCount,
      removeCount: this.removes.length,
      positionCount: this.positionCount,
    };
  }

  private intern(value: string): number {
    const existing = this.stringIndices.get(value);
    if (existing != null) {
      return existing;
    }
    const index = this.strings.length;
    this.strings.push(value);
    this.stringIndices.set(value, index);
    return index;
  }

  private internOptional(value: string | undefined): number {
    return value == null ? NO_STRING : this.intern(value);
  }
}

export interface DecodedUpsert {
  handle: number;
  descriptor: MarkerDescriptor;
}

export interface DecodedPosition {
  handle: number;
  coordinate: Coordinate;
}

export interface DecodedMarkerBatch {
  upserts: DecodedUpsert[];
  removes: number[];
  positions: DecodedPosition[];
}

function optionalFloat(value: number): number | undefined {
  return Number.isNaN(value) ? undefined : value;
}

function stringAt(strings: string[], index: number): string | undefined {
  return index === NO_STRING ? undefined : strings[index];
}

/**
 * Reads a batch back into descriptors with the same optional-field semantics
 * the native decoders use. Reference implementation for tests and debugging.
 */
export function decodeMarkerBatch(batch: MarkerBatch): DecodedMarkerBatch {
  const view = new DataView(batch.buffer);
  if (view.getUint32(0, true) !== MARKER_BATCH_MAGIC) {
    throw new Error('Not a marker batch');
  }

  const upsertCount = view.getUint32(4, true);
  const removeCount = view.getUint32(8, true);
  const positionCount = view.getUint32(12, true);
  const expected =
    MARKER_BATCH_HEADER_BYTES +
    upsertCount * UPSERT_RECORD_BYTES +
    removeCount * REMOVE_RECORD_BYTES +
    positionCount * POSITION_RECORD_BYTES;
  if (batch.buffer.byteLength !== expected) {
    throw new Error(
      `Marker batch is ${batch.buffer.byteLength} bytes, expected ${expected}`,
    );
  }

  const strings = batch.strings;
  let offset = MARKER_BATCH_HEADER_BYTES;
  const upserts: DecodedUpsert[] = [];
  for (let index = 0; index < upsertCount; index += 1) {
    const base = offset;
    const flags = view.getUint32(base + UpsertOffset.flags, true);
    const imageUri = stringAt(
      strings,
      view.getInt32(base + UpsertOffset.imageUri, true),
    );
    const animationKind = view.getUint8(base + UpsertOffset.animationKind);
    const reduceMotion = view.getUint8(
      base + UpsertOffset.animationReduceMotion,
    );
    const enteringAnimation: OverlayEnteringAnimationDescriptor | undefined =
      animationKind === 0
        ? undefined
        : {
            kind: ANIMATION_KINDS[animationKind - 1],
            duration: optionalFloat(
              view.getFloat32(base + UpsertOffset.animationDuration, true),
            ),
            delay: optionalFloat(
              view.getFloat32(base + UpsertOffset.animationDelay, true),
            ),
            reduceMotion:
              reduceMotion === 0
                ? undefined
                : REDUCE_MOTION_VALUES[reduceMotion - 1],
          };

    upserts.push({
      handle: view.getUint32(base + UpsertOffset.handle, true),
      descriptor: {
        id: strings[view.getInt32(base + UpsertOffset.id, true)],
        coordinate: {
          latitude: view.getFloat64(base + UpsertOffset.latitude, true),
          longitude: view.getFloat64(base + UpsertOffset.longitude, true),
        },
        title: stringAt(
          strings,
          view.getInt32(base + UpsertOffset.title, true),
        ),
        subtitle: stringAt(
          strings,
          view.getInt32(base + UpsertOffset.subtitle, true),
        ),
        draggable: (flags & UpsertFlag.draggable) !== 0 ? true : undefined,
        clusterable: (flags & UpsertFlag.clusterable) !== 0 ? undefined : false,
        image:
          imageUri == null
            ? undefined
            : {
                uri: imageUri,
                width: optionalFloat(
                  view.getFloat32(base + UpsertOffset.imageWidth, true),
                ),
                height: optionalFloat(
                  view.getFloat32(base + UpsertOffset.imageHeight, true),
                ),
                scale: optionalFloat(
                  view.getFloat32(base + UpsertOffset.imageScale, true),
                ),
              },
        anchor:
          (flags & UpsertFlag.hasAnchor) !== 0
            ? {
                x: view.getFloat32(base + UpsertOffset.anchorX, true),
                y: view.getFloat32(base + UpsertOffset.anchorY, true),
              }
            : undefined,
        centerOffset:
          (flags & UpsertFlag.hasCenterOffset) !== 0
            ? {
                x: view.getFloat32(base + UpsertOffset.centerOffsetX, true),
                y: view.getFloat32(base + UpsertOffset.centerOffsetY, true),
              }
            : undefined,
        rotation: optionalFloat(
          view.getFloat32(base + UpsertOffset.rotation, true),
        ),
        flat: (flags & UpsertFlag.flat) !== 0 ? true : undefined,
        opacity: optionalFloat(
          view.getFloat32(base + UpsertOffset.opacity, true),
        ),
        markerColor: stringAt(
          strings,
          view.getInt32(base + UpsertOffset.markerColor, true),
        ),
        zIndex: optionalFloat(
          view.getFloat32(base + UpsertOffset.zIndex, true),
        ),
        enteringAnimation,
      },
    });
    offset += UPSERT_RECORD_BYTES;
  }

  const removes: number[] = [];
  for (let index = 0; index < removeCount; index += 1) {
    removes.push(view.getUint32(offset, true));
    offset += REMOVE_RECORD_BYTES;
  }

  const positions: DecodedPosition[] = [];
  for (let index = 0; index < positionCount; index += 1) {
    positions.push({
      handle: view.getUint32(offset, true),
      coordinate: {
        latitude: view.getFloat64(offset + 8, true),
        longitude: view.getFloat64(offset + 16, true),
      },
    });
    offset += POSITION_RECORD_BYTES;
  }

  return { upserts, removes, positions };
}
