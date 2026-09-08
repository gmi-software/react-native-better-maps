import type { HybridObject } from 'react-native-nitro-modules';

/**
 * Native-owned marker store.
 *
 * JS assigns each marker an integer handle and feeds the store with packed
 * batches (see `overlays/markerBatch.ts` for the record layout). The store
 * keeps one copy of the dataset natively, maintains a spatial index over
 * handles and notifies every attached map view when a batch has been applied.
 *
 * Nothing here is called by application code directly; use the
 * `MarkerCollection` class or the `markers` prop, which compile to batches.
 */
export interface MarkerCollection extends HybridObject<{
  ios: 'swift';
  android: 'kotlin';
}> {
  /**
   * Applies one packed batch of upserts, removals and position updates.
   *
   * `strings` holds every string the batch references (ids, titles,
   * subtitles, image URIs), each sent once per batch.
   */
  applyBatch(batch: ArrayBuffer, strings: string[]): void;

  /** Removes every marker from the store. */
  clear(): void;

  /** Number of markers currently stored. */
  readonly size: number;
}
