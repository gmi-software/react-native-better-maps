/**
 * Hermes exposes cumulative runtime counters through
 * `HermesInternal.getInstrumentedStats()`. Which keys exist depends on the
 * engine build, so everything is read defensively; deltas between two reads
 * give the JS allocation and GC activity of the work in between.
 */
export interface HermesStats {
  available: boolean;
  numGCs: number | null;
  gcTimeMs: number | null;
  totalAllocatedBytes: number | null;
  allocatedBytes: number | null;
  heapSizeBytes: number | null;
  mallocSizeEstimateBytes: number | null;
  externalBytes: number | null;
  raw: Record<string, number>;
}

interface HermesInternalLike {
  getInstrumentedStats?: () => Record<string, unknown>;
  getRuntimeProperties?: () => Record<string, unknown>;
}

function hermes(): HermesInternalLike | null {
  const candidate = (
    globalThis as { HermesInternal?: HermesInternalLike | null }
  ).HermesInternal;
  return candidate ?? null;
}

export function isHermes(): boolean {
  return hermes() != null;
}

function pick(raw: Record<string, number>, ...keys: string[]): number | null {
  for (const key of keys) {
    if (typeof raw[key] === 'number') {
      return raw[key];
    }
  }
  return null;
}

export function readHermesStats(): HermesStats {
  const runtime = hermes();
  const raw: Record<string, number> = {};
  if (runtime?.getInstrumentedStats != null) {
    try {
      for (const [key, value] of Object.entries(
        runtime.getInstrumentedStats(),
      )) {
        if (typeof value === 'number') {
          raw[key] = value;
        }
      }
    } catch {
      // Older engines throw when the stats API is compiled out.
    }
  }
  const available = Object.keys(raw).length > 0;
  return {
    available,
    numGCs: pick(raw, 'js_numGCs', 'js_gcNum'),
    gcTimeMs: pick(raw, 'js_gcTime', 'js_gcTimeMs'),
    totalAllocatedBytes: pick(raw, 'js_totalAllocatedBytes'),
    allocatedBytes: pick(raw, 'js_allocatedBytes'),
    heapSizeBytes: pick(raw, 'js_heapSize'),
    mallocSizeEstimateBytes: pick(raw, 'js_mallocSizeEstimate'),
    externalBytes: pick(raw, 'js_externalBytes'),
    raw,
  };
}

export interface HermesDelta {
  available: boolean;
  gcCount: number | null;
  gcTimeMs: number | null;
  allocatedBytes: number | null;
  heapSizeAfterBytes: number | null;
}

export function hermesDelta(
  before: HermesStats,
  after: HermesStats,
): HermesDelta {
  const delta = (a: number | null, b: number | null) =>
    a == null || b == null ? null : b - a;
  return {
    available: before.available && after.available,
    gcCount: delta(before.numGCs, after.numGCs),
    gcTimeMs: delta(before.gcTimeMs, after.gcTimeMs),
    allocatedBytes: delta(
      before.totalAllocatedBytes,
      after.totalAllocatedBytes,
    ),
    heapSizeAfterBytes: after.heapSizeBytes,
  };
}
