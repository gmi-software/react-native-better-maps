import type { PerfMapProps } from '../../scenarios/types';

export interface PayloadEstimate {
  items: number;
  coordinates: number;
  /** Estimated JSON size in bytes, from a sample of up to 64 items. */
  estimatedBytes: number;
}

export type OverlayKey =
  'markers' | 'markerChildren' | 'polylines' | 'polygons' | 'circles';

const OVERLAY_KEYS: OverlayKey[] = [
  'markers',
  'markerChildren',
  'polylines',
  'polygons',
  'circles',
];

function coordinateCount(key: OverlayKey, item: unknown): number {
  if (key === 'polylines' || key === 'polygons') {
    return (item as { coordinates: unknown[] }).coordinates.length;
  }
  return 1;
}

/**
 * Describes what a prop update sends across the bridge: how many objects,
 * how many coordinates, and roughly how many bytes they would be as JSON.
 * The byte estimate samples the first items and scales, so it is O(1) in the
 * array length and does not itself stall the JS thread.
 */
export function estimatePayload(
  key: OverlayKey,
  value: unknown[],
): PayloadEstimate {
  const items = value.length;
  if (items === 0) {
    return { items: 0, coordinates: 0, estimatedBytes: 2 };
  }
  const sampleSize = Math.min(64, items);
  let sampleBytes = 0;
  let sampleCoordinates = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    sampleBytes += JSON.stringify(value[index]).length + 1;
    sampleCoordinates += coordinateCount(key, value[index]);
  }
  let coordinates = sampleCoordinates;
  if (sampleSize < items) {
    if (key === 'polylines' || key === 'polygons') {
      for (let index = sampleSize; index < items; index += 1) {
        coordinates += coordinateCount(key, value[index]);
      }
    } else {
      coordinates = items;
    }
  }
  return {
    items,
    coordinates,
    estimatedBytes: Math.round((sampleBytes / sampleSize) * items) + 2,
  };
}

export interface TransferSummary {
  /** Prop updates issued by the lab per overlay key (each becomes one native setter call). */
  updates: Record<string, number>;
  /** Cumulative payload across updates, per overlay key. */
  payload: Record<string, PayloadEstimate>;
  /** Largest single update per key. */
  largestUpdate: Record<string, PayloadEstimate>;
  /** Callbacks received from native during the recording. */
  eventsToJs: Record<string, number>;
}

export class TransferTracker {
  private updates: Record<string, number> = {};
  private payload: Record<string, PayloadEstimate> = {};
  private largest: Record<string, PayloadEstimate> = {};
  private events: Record<string, number> = {};

  recordPatch(patch: Partial<PerfMapProps>): void {
    for (const key of OVERLAY_KEYS) {
      const value = patch[key];
      if (!Array.isArray(value)) {
        continue;
      }
      const estimate = estimatePayload(key, value);
      this.updates[key] = (this.updates[key] ?? 0) + 1;
      const total = this.payload[key] ?? {
        items: 0,
        coordinates: 0,
        estimatedBytes: 0,
      };
      this.payload[key] = {
        items: total.items + estimate.items,
        coordinates: total.coordinates + estimate.coordinates,
        estimatedBytes: total.estimatedBytes + estimate.estimatedBytes,
      };
      const largest = this.largest[key];
      if (largest == null || estimate.estimatedBytes > largest.estimatedBytes) {
        this.largest[key] = estimate;
      }
    }
    for (const key of ['region', 'clusteringEnabled'] as const) {
      if (patch[key] !== undefined) {
        this.updates[key] = (this.updates[key] ?? 0) + 1;
      }
    }
  }

  recordEvent(name: string): void {
    this.events[name] = (this.events[name] ?? 0) + 1;
  }

  summary(): TransferSummary {
    return {
      updates: { ...this.updates },
      payload: { ...this.payload },
      largestUpdate: { ...this.largest },
      eventsToJs: { ...this.events },
    };
  }
}
