import { NitroModules } from 'react-native-nitro-modules';
import type { MarkerCollection as NativeMarkerCollection } from '../native/specs/MarkerCollection.nitro';
import type { MarkerDescriptor as NativeMarkerDescriptor } from '../native/specs/overlays';
import { normalizeMarkerDescriptors } from '../overlays/normalizeMarkerDescriptors';
import type { MarkerDescriptor } from '../types/overlays';
import type { MarkerBatch } from './markerBatch';
import {
  MarkerDeltaCompiler,
  type MarkerPositionUpdate,
} from './markerDeltaCompiler';

export type { MarkerPositionUpdate } from './markerDeltaCompiler';

/** What `MapView` needs from a collection and application code does not. */
export interface MarkerCollectionInternals {
  native: NativeMarkerCollection;
  /** Like `set`, for descriptors that are already normalized. */
  setNormalized(descriptors: NativeMarkerDescriptor[]): void;
}

const internals = new WeakMap<MarkerCollection, MarkerCollectionInternals>();

/**
 * A marker dataset owned by native code and updated through deltas.
 *
 * Pass it to `MapView` through the `markerCollection` prop, then keep it up to
 * date with `set`, `upsert`, `remove` and `updatePositions`. Every call sends
 * one packed batch across JSI that only carries what changed, so a single
 * marker moving in a 100,000-marker dataset costs one 24-byte record instead
 * of re-serializing the whole array.
 *
 * The `markers` prop and `<Marker>` children compile to the same batches
 * through an internal collection, so they stay the simplest option for small
 * or mostly static datasets.
 */
export class MarkerCollection {
  private readonly compiler = new MarkerDeltaCompiler();
  private readonly native: NativeMarkerCollection;

  constructor() {
    this.native =
      NitroModules.createHybridObject<NativeMarkerCollection>(
        'MarkerCollection',
      );
    internals.set(this, {
      native: this.native,
      setNormalized: (descriptors) =>
        this.flush(this.compiler.set(descriptors)),
    });
  }

  /** Number of markers in the collection. */
  get size(): number {
    return this.compiler.size;
  }

  has(id: string): boolean {
    return this.compiler.has(id);
  }

  /** Every marker id in the collection, in insertion order. */
  ids(): string[] {
    return this.compiler.ids();
  }

  /**
   * Replaces the whole dataset. Markers that are unchanged compared to the
   * last call are not sent again; markers missing from `markers` are removed.
   */
  set(markers: MarkerDescriptor[]): void {
    this.flush(this.compiler.set(normalizeMarkerDescriptors(markers)));
  }

  /** Adds new markers and updates existing ones by id. */
  upsert(markers: MarkerDescriptor[]): void {
    this.flush(this.compiler.upsert(normalizeMarkerDescriptors(markers)));
  }

  /** Removes markers by id. Unknown ids are ignored. */
  remove(ids: string[]): void {
    this.flush(this.compiler.remove(ids));
  }

  /**
   * Moves markers without changing anything else about them. This is the path
   * for animated or live-updating markers: no strings, no descriptor rebuild,
   * one small record per marker.
   */
  updatePositions(updates: MarkerPositionUpdate[]): void {
    this.flush(this.compiler.updatePositions(updates));
  }

  /** Removes every marker. */
  clear(): void {
    this.compiler.clear();
    this.native.clear();
  }

  private flush(batch: MarkerBatch | null): void {
    if (batch != null) {
      this.native.applyBatch(batch.buffer, batch.strings);
    }
  }
}

/** @internal */
export function markerCollectionInternals(
  collection: MarkerCollection,
): MarkerCollectionInternals {
  const found = internals.get(collection);
  if (found == null) {
    throw new Error('Not a MarkerCollection');
  }
  return found;
}
