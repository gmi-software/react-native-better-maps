import type { MarkerDescriptor } from '../native/specs/overlays';
import { markerDescriptorsEqual } from '../overlays/descriptorEquality';
import type { Coordinate } from '../types/coordinate';
import { MarkerBatchWriter, type MarkerBatch } from './markerBatch';

/** A coordinate-only update for a marker that is already in the collection. */
export interface MarkerPositionUpdate {
  id: string;
  coordinate: Coordinate;
}

interface Entry {
  handle: number;
  descriptor: MarkerDescriptor;
}

/**
 * Turns marker arrays and edits into delta batches.
 *
 * Keeps the last descriptor sent for every id, so a `set()` with a new array
 * costs one structural comparison per marker and produces records only for
 * the markers that changed. Handles are dense integers assigned here; a
 * removed marker's handle goes back on a free list and is reused by the next
 * insert.
 */
export class MarkerDeltaCompiler {
  private readonly entries = new Map<string, Entry>();
  private readonly freeHandles: number[] = [];
  private nextHandle = 0;

  get size(): number {
    return this.entries.size;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** The descriptor last sent for `id`, if any. */
  get(id: string): MarkerDescriptor | undefined {
    return this.entries.get(id)?.descriptor;
  }

  /** Every id currently in the collection, in insertion order. */
  ids(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Makes the collection equal to `descriptors`: upserts what is new or
   * changed and removes what is missing. The first descriptor wins when an id
   * repeats.
   */
  set(descriptors: MarkerDescriptor[]): MarkerBatch | null {
    const writer = new MarkerBatchWriter();
    const seen = new Set<string>();
    for (const descriptor of descriptors) {
      if (seen.has(descriptor.id)) {
        continue;
      }
      seen.add(descriptor.id);
      this.upsertOne(descriptor, writer);
    }

    for (const [id, entry] of this.entries) {
      if (!seen.has(id)) {
        this.entries.delete(id);
        this.freeHandles.push(entry.handle);
        writer.remove(entry.handle);
      }
    }

    return writer.finish();
  }

  upsert(descriptors: MarkerDescriptor[]): MarkerBatch | null {
    const writer = new MarkerBatchWriter();
    for (const descriptor of descriptors) {
      this.upsertOne(descriptor, writer);
    }
    return writer.finish();
  }

  remove(ids: string[]): MarkerBatch | null {
    const writer = new MarkerBatchWriter();
    for (const id of ids) {
      const entry = this.entries.get(id);
      if (entry == null) {
        continue;
      }
      this.entries.delete(id);
      this.freeHandles.push(entry.handle);
      writer.remove(entry.handle);
    }
    return writer.finish();
  }

  /**
   * Moves markers without touching their other fields. Unknown ids are
   * ignored; an unchanged coordinate produces no record.
   */
  updatePositions(updates: MarkerPositionUpdate[]): MarkerBatch | null {
    const writer = new MarkerBatchWriter();
    for (const update of updates) {
      const entry = this.entries.get(update.id);
      if (entry == null) {
        continue;
      }
      const current = entry.descriptor.coordinate;
      if (
        current.latitude === update.coordinate.latitude &&
        current.longitude === update.coordinate.longitude
      ) {
        continue;
      }
      entry.descriptor = { ...entry.descriptor, coordinate: update.coordinate };
      writer.position(entry.handle, update.coordinate);
    }
    return writer.finish();
  }

  /** Forgets everything, including handle assignments. */
  clear(): void {
    this.entries.clear();
    this.freeHandles.length = 0;
    this.nextHandle = 0;
  }

  private upsertOne(
    descriptor: MarkerDescriptor,
    writer: MarkerBatchWriter,
  ): void {
    const entry = this.entries.get(descriptor.id);
    if (entry == null) {
      const handle = this.freeHandles.pop() ?? this.nextHandle++;
      this.entries.set(descriptor.id, { handle, descriptor });
      writer.upsert(handle, descriptor);
      return;
    }

    if (markerDescriptorsEqual(entry.descriptor, descriptor)) {
      return;
    }
    entry.descriptor = descriptor;
    writer.upsert(entry.handle, descriptor);
  }
}
