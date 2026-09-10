import type { MemorySnapshot } from '../../../example/modules/perf-lab';
import { roundTo } from './stats';

const MB = 1024 * 1024;

export function toMB(bytes: number | undefined | null): number | null {
  if (bytes == null || bytes < 0) {
    return null;
  }
  return roundTo(bytes / MB, 1);
}

export interface MemoryPoint {
  label: string;
  footprintMB: number | null;
  residentMB: number | null;
  javaHeapMB?: number | null;
  nativeHeapMB?: number | null;
  mallocBlocks?: number | null;
  mallocMB?: number | null;
}

export function memoryPoint(
  label: string,
  snapshot: MemorySnapshot,
): MemoryPoint {
  return {
    label,
    footprintMB: toMB(snapshot.footprintBytes),
    residentMB: toMB(snapshot.residentBytes),
    javaHeapMB: toMB(snapshot.javaHeapUsedBytes),
    nativeHeapMB: toMB(snapshot.nativeHeapAllocatedBytes),
    mallocBlocks: snapshot.mallocBlocksInUse ?? null,
    mallocMB: toMB(snapshot.mallocBytesInUse),
  };
}

export interface MemorySummary {
  beforeMB: number | null;
  afterLoadMB: number | null;
  afterInteractionMB: number | null;
  afterCleanupMB: number | null;
  peakMB: number | null;
  loadDeltaMB: number | null;
  interactionDeltaMB: number | null;
  /** Footprint after unmount minus footprint before mount: what the scenario left behind. */
  retainedAfterCleanupMB: number | null;
  points: MemoryPoint[];
}

function diff(a: number | null, b: number | null): number | null {
  return a == null || b == null ? null : roundTo(b - a, 1);
}

export function summarizeMemory(points: MemoryPoint[]): MemorySummary {
  const find = (label: string) =>
    points.find((point) => point.label === label)?.footprintMB ?? null;
  const before = find('before');
  const afterLoad = find('afterLoad');
  const afterInteraction = find('afterInteraction');
  const afterCleanup = find('afterCleanup');
  let peak: number | null = null;
  for (const point of points) {
    if (
      point.footprintMB != null &&
      (peak == null || point.footprintMB > peak)
    ) {
      peak = point.footprintMB;
    }
  }
  return {
    beforeMB: before,
    afterLoadMB: afterLoad,
    afterInteractionMB: afterInteraction,
    afterCleanupMB: afterCleanup,
    peakMB: peak,
    loadDeltaMB: diff(before, afterLoad),
    interactionDeltaMB: diff(afterLoad, afterInteraction),
    retainedAfterCleanupMB: diff(before, afterCleanup),
    points,
  };
}

export interface AllocationSummary {
  hermes: {
    available: boolean;
    allocatedBytes: number | null;
    gcCount: number | null;
    gcTimeMs: number | null;
    heapSizeAfterMB: number | null;
  };
  android: {
    javaBytesAllocated: number | null;
    gcCount: number | null;
    gcTimeMs: number | null;
    blockingGcCount: number | null;
    nativeHeapDeltaBytes: number | null;
  } | null;
  ios: {
    mallocBlocksDelta: number | null;
    mallocBytesDelta: number | null;
  } | null;
}

function delta(a: number | undefined, b: number | undefined): number | null {
  if (a == null || b == null || a < 0 || b < 0) {
    return null;
  }
  return b - a;
}

export function platformAllocationDelta(
  platform: 'ios' | 'android',
  before: MemorySnapshot,
  after: MemorySnapshot,
): Pick<AllocationSummary, 'android' | 'ios'> {
  if (platform === 'android') {
    return {
      android: {
        javaBytesAllocated: delta(before.bytesAllocated, after.bytesAllocated),
        gcCount: delta(before.gcCount, after.gcCount),
        gcTimeMs: delta(before.gcTimeMs, after.gcTimeMs),
        blockingGcCount: delta(before.blockingGcCount, after.blockingGcCount),
        nativeHeapDeltaBytes: delta(
          before.nativeHeapAllocatedBytes,
          after.nativeHeapAllocatedBytes,
        ),
      },
      ios: null,
    };
  }
  return {
    android: null,
    ios: {
      mallocBlocksDelta: delta(
        before.mallocBlocksInUse,
        after.mallocBlocksInUse,
      ),
      mallocBytesDelta: delta(before.mallocBytesInUse, after.mallocBytesInUse),
    },
  };
}
