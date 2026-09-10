/**
 * Metric definitions shared by `compare`, `check` and `report`.
 * `better`: which direction is an improvement. `kind`: how to format.
 */
export const METRICS = [
  { key: 'fps', label: 'FPS avg', better: 'higher', kind: 'number', get: (r) => r.frames?.fps?.average },
  { key: 'fpsP95', label: 'FPS p95 window', better: 'higher', kind: 'number', get: (r) => r.frames?.fps?.p95 },
  { key: 'p50', label: 'Frame p50', better: 'lower', kind: 'ms', get: (r) => r.frames?.frameTimeMs?.p50 },
  { key: 'p95', label: 'Frame p95', better: 'lower', kind: 'ms', get: (r) => r.frames?.frameTimeMs?.p95 },
  { key: 'p99', label: 'Frame p99', better: 'lower', kind: 'ms', get: (r) => r.frames?.frameTimeMs?.p99 },
  { key: 'worst', label: 'Worst frame', better: 'lower', kind: 'ms', get: (r) => r.frames?.frameTimeMs?.worst },
  { key: 'jank', label: 'Jank ratio', better: 'lower', kind: 'ratio', get: (r) => r.frames?.jankRatio },
  { key: 'longFrames', label: 'Frames > 50 ms', better: 'lower', kind: 'count', get: (r) => r.frames?.longFrames },
  { key: 'jsLagP95', label: 'JS lag p95', better: 'lower', kind: 'ms', get: (r) => r.js?.lagMs?.p95 },
  { key: 'jsBusy', label: 'JS busy ratio', better: 'lower', kind: 'ratio', get: (r) => r.js?.busyRatio },
  { key: 'jsCommitBusy', label: 'JS commit busy', better: 'lower', kind: 'ratio', get: (r) => (r.js?.commits?.count > 0 && r.durationMs > 0 ? r.js.commits.totalMs / r.durationMs : null) },
  { key: 'jsCommit', label: 'JS commit avg', better: 'lower', kind: 'ms', get: (r) => (r.js?.commits?.count > 0 ? r.js.commits.avgMs : null) },
  { key: 'jsCommitMax', label: 'JS commit max', better: 'lower', kind: 'ms', get: (r) => (r.js?.commits?.count > 0 ? r.js.commits.maxMs : null) },
  { key: 'loadCommit', label: 'Mount commit', better: 'lower', kind: 'ms', get: (r) => r.load?.commitMs },
  { key: 'loadReady', label: 'Mount → ready', better: 'lower', kind: 'ms', get: (r) => r.load?.readyMs },
  { key: 'nativeMain', label: 'Native main-thread', better: 'lower', kind: 'ms', get: (r) => (r.native?.available ? r.native.mainThreadMs : null) },
  { key: 'nativeBg', label: 'Native background', better: 'lower', kind: 'ms', get: (r) => (r.native?.available ? r.native.backgroundMs : null) },
  { key: 'setter', label: 'Native setter avg', better: 'lower', kind: 'ms', get: (r) => r.bridge?.setterMs?.avgMs ?? null },
  { key: 'bridgeLatency', label: 'Commit → native', better: 'lower', kind: 'ms', get: (r) => r.bridge?.commitToNativeMs?.avgMs ?? null },
  { key: 'memAfter', label: 'RAM after', better: 'lower', kind: 'mb', get: (r) => r.memory?.afterInteractionMB },
  { key: 'memDelta', label: 'RAM Δ interaction', better: 'lower', kind: 'mb', get: (r) => r.memory?.interactionDeltaMB },
  { key: 'memRetained', label: 'RAM retained', better: 'lower', kind: 'mb', get: (r) => r.memory?.retainedAfterCleanupMB },
  { key: 'jsAlloc', label: 'JS allocated', better: 'lower', kind: 'bytes', get: (r) => r.allocations?.hermes?.allocatedBytes ?? null },
  { key: 'jsGc', label: 'JS GCs', better: 'lower', kind: 'count', get: (r) => r.allocations?.hermes?.gcCount ?? null },
  { key: 'javaAlloc', label: 'Java allocated', better: 'lower', kind: 'bytes', get: (r) => r.allocations?.android?.javaBytesAllocated ?? null },
  { key: 'javaGc', label: 'ART GCs', better: 'lower', kind: 'count', get: (r) => r.allocations?.android?.gcCount ?? null },
  { key: 'mallocBlocks', label: 'malloc blocks Δ', better: 'lower', kind: 'count', get: (r) => r.allocations?.ios?.mallocBlocksDelta ?? null },
  { key: 'cpu', label: 'CPU', better: 'lower', kind: 'pct', get: (r) => r.cpu?.percent },
];

export const SCORECARD_METRICS = ['fps', 'p95', 'p99', 'worst', 'jank', 'jsLagP95', 'jsCommit', 'nativeMain', 'memAfter', 'memDelta', 'jsAlloc', 'cpu'];

export function metric(key) {
  return METRICS.find((entry) => entry.key === key);
}

export function formatValue(kind, value) {
  if (value == null || Number.isNaN(value)) {
    return 'N/A';
  }
  switch (kind) {
    case 'ms':
      return `${Number(value).toFixed(value < 10 ? 2 : 1)} ms`;
    case 'ratio':
      return `${(Number(value) * 100).toFixed(1)} %`;
    case 'pct':
      return `${Number(value).toFixed(0)} %`;
    case 'mb':
      return `${Number(value).toFixed(0)} MB`;
    case 'bytes': {
      const abs = Math.abs(value);
      if (abs >= 1024 * 1024) {
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
      }
      if (abs >= 1024) {
        return `${(value / 1024).toFixed(0)} KB`;
      }
      return `${value} B`;
    }
    case 'count':
      return String(Math.round(value));
    default:
      return Number(value).toFixed(1);
  }
}

/**
 * Signed percentage change from baseline to current, oriented so that a
 * positive number is always an improvement. Returns null when either side
 * is unavailable.
 */
export function improvementPct(definition, baseline, current, minAbsolute = 0) {
  if (baseline == null || current == null) {
    return null;
  }
  if (Math.abs(current - baseline) < minAbsolute) {
    return 0;
  }
  if (baseline === 0) {
    return current === 0 ? 0 : definition.better === 'lower' ? -100 : 100;
  }
  const change = ((current - baseline) / Math.abs(baseline)) * 100;
  return definition.better === 'lower' ? -change : change;
}
