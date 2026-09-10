import { METRICS, SCORECARD_METRICS, formatValue, improvementPct, metric } from './metrics.mjs';
import { markdownTable } from './util.mjs';

/**
 * Compares two loaded runs scenario by scenario. Every metric row carries
 * both values and the improvement percentage oriented so positive is better;
 * `null` means one side did not measure it (rendered as N/A, never guessed).
 */
export function compareRuns(baseline, current, options = {}) {
  const minAbsoluteMs = options.minAbsoluteMs ?? 0;
  const scenarios = [];
  const missing = [];
  for (const [id, currentResult] of current.results) {
    const baselineResult = baseline.results.get(id);
    if (baselineResult == null) {
      missing.push(id);
      continue;
    }
    const rows = METRICS.map((definition) => {
      const before = definition.get(baselineResult) ?? null;
      const after = definition.get(currentResult) ?? null;
      const minAbsolute = definition.kind === 'ms' ? minAbsoluteMs : 0;
      return {
        key: definition.key,
        label: definition.label,
        kind: definition.kind,
        better: definition.better,
        baseline: before,
        current: after,
        improvementPct: improvementPct(definition, before, after, minAbsolute),
      };
    });
    scenarios.push({ scenario: id, rows });
  }
  return { scenarios, missing };
}

function signed(value) {
  if (value == null) {
    return 'N/A';
  }
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} %`;
}

/** Compact overview: one row per scenario, one column per key metric ("current (±change)"). */
export function formatOverview(comparison, keys = SCORECARD_METRICS) {
  const headers = ['Scenario', ...keys.map((key) => metric(key)?.label ?? key)];
  const rows = comparison.scenarios.map(({ scenario, rows: metricRows }) => [
    scenario,
    ...keys.map((key) => {
      const row = metricRows.find((entry) => entry.key === key);
      if (row == null || row.current == null) {
        return 'N/A';
      }
      return `${formatValue(row.kind, row.current)} (${signed(row.improvementPct)})`;
    }),
  ]);
  return markdownTable(headers, rows, ['left', ...keys.map(() => 'right')]);
}

/** One table per scenario with every metric: | Metric | Baseline | Current | Change |. */
export function formatDetail(comparison) {
  const sections = [];
  for (const { scenario, rows } of comparison.scenarios) {
    const table = markdownTable(
      ['Metric', 'Baseline', 'Current', 'Change (+ is better)'],
      rows.map((row) => [
        row.label,
        formatValue(row.kind, row.baseline),
        formatValue(row.kind, row.current),
        signed(row.improvementPct),
      ]),
      ['left', 'right', 'right', 'right'],
    );
    sections.push(`### ${scenario}\n\n${table}`);
  }
  return sections.join('\n\n');
}

const THRESHOLD_BY_METRIC = {
  fps: (thresholds) => ({ pct: thresholds.fpsDropPct }),
  p95: (thresholds) => ({ pct: thresholds.p95FrameTimeIncreasePct }),
  p99: (thresholds) => ({ pct: thresholds.p99FrameTimeIncreasePct }),
  memAfter: (thresholds) => ({ pct: thresholds.memoryIncreasePct }),
  jsCommit: (thresholds) => ({ pct: thresholds.jsCommitIncreasePct }),
  setter: (thresholds) => ({ pct: thresholds.nativeSetterIncreasePct }),
  jank: (thresholds) => ({ points: thresholds.jankRatioIncreasePoints }),
};

/**
 * Applies the configured thresholds. A metric regresses when it moved in the
 * wrong direction by more than its threshold; metrics that are N/A on either
 * side are skipped (and listed), never treated as passing or failing.
 */
export function checkRegressions(comparison, thresholds) {
  const regressions = [];
  const improvements = [];
  const skipped = [];
  for (const { scenario, rows } of comparison.scenarios) {
    for (const row of rows) {
      const rule = THRESHOLD_BY_METRIC[row.key];
      if (rule == null) {
        continue;
      }
      if (row.baseline == null || row.current == null) {
        skipped.push({ scenario, metric: row.key });
        continue;
      }
      const { pct, points } = rule(thresholds);
      let regressed = false;
      let improved = false;
      if (points != null) {
        const delta = (row.current - row.baseline) * 100;
        regressed = delta > points;
        improved = delta < -points;
      } else {
        regressed = row.improvementPct != null && row.improvementPct < -pct;
        improved = row.improvementPct != null && row.improvementPct > pct;
      }
      const entry = {
        scenario,
        metric: row.key,
        label: row.label,
        baseline: formatValue(row.kind, row.baseline),
        current: formatValue(row.kind, row.current),
        change: signed(row.improvementPct),
        threshold: points != null ? `${points} points` : `${pct} %`,
      };
      if (regressed) {
        regressions.push(entry);
      } else if (improved) {
        improvements.push(entry);
      }
    }
  }
  return { regressions, improvements, skipped };
}

/** The scorecard table used in PERFORMANCE.md. */
export function scorecard(results, keys = SCORECARD_METRICS) {
  const headers = ['Scenario', ...keys.map((key) => metric(key)?.label ?? key)];
  const rows = [...results.values()].map((result) => [
    result.scenario,
    ...keys.map((key) => formatValue(metric(key).kind, metric(key).get(result) ?? null)),
  ]);
  return markdownTable(headers, rows, ['left', ...keys.map(() => 'right')]);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Least-squares slope of log(cost) against log(size): the empirical scaling exponent. */
export function fitExponent(points) {
  const usable = points.filter((point) => point.n > 0 && point.ms > 0);
  if (usable.length < 2) {
    return null;
  }
  const xs = usable.map((point) => Math.log(point.n));
  const ys = usable.map((point) => Math.log(point.ms));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    numerator += (xs[index] - meanX) * (ys[index] - meanY);
    denominator += (xs[index] - meanX) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}

const STEP_SPANS = ['markers.set', 'markers.fingerprint', 'markers.indexBuild', 'markers.viewportCompute', 'markers.applyDiff', 'markers.applySync', 'polylines.set', 'polygons.set'];

/**
 * Aggregates a result's steps by label (median over repeats) into a table:
 * the marker-update benchmark and the geometry updates read from this.
 */
export function stepsTable(result) {
  const groups = new Map();
  for (const step of result.steps ?? []) {
    let group = groups.get(step.label);
    if (group == null) {
      group = { label: step.label, meta: step.meta, commit: [], setter: [], latency: [], spans: {}, jsAlloc: [] };
      groups.set(step.label, group);
    }
    if (step.commits?.count > 0) {
      group.commit.push(step.commits.avgMs);
    }
    if (step.bridge?.setterMs) {
      group.setter.push(step.bridge.setterMs.avgMs);
    }
    if (step.bridge?.commitToNativeMs) {
      group.latency.push(step.bridge.commitToNativeMs.avgMs);
    }
    for (const span of STEP_SPANS) {
      const stat = step.native?.byName?.[span];
      if (stat) {
        (group.spans[span] ??= []).push(stat.totalMs);
      }
    }
    if (step.hermes?.allocatedBytes != null) {
      group.jsAlloc.push(step.hermes.allocatedBytes);
    }
  }
  const spanKeys = STEP_SPANS.filter((span) => [...groups.values()].some((group) => group.spans[span]));
  const headers = ['Step', 'Changed', 'JS commit', 'Commit → native', 'Native setter', ...spanKeys, 'JS alloc'];
  const rows = [...groups.values()].map((group) => [
    group.label,
    group.meta?.changed ?? group.meta?.points ?? '',
    formatValue('ms', median(group.commit)),
    formatValue('ms', median(group.latency)),
    formatValue('ms', median(group.setter)),
    ...spanKeys.map((span) => formatValue('ms', median(group.spans[span] ?? []))),
    formatValue('bytes', median(group.jsAlloc)),
  ]);
  const points = [...groups.values()]
    .filter((group) => typeof group.meta?.changed === 'number' && group.commit.length > 0)
    .map((group) => ({ n: group.meta.changed, ms: median(group.commit) }));
  return { table: markdownTable(headers, rows, ['left', 'right', ...headers.slice(2).map(() => 'right')]), exponent: fitExponent(points) };
}

/** Timeline windows of a long-running scenario: does anything drift? */
export function timelineTable(result) {
  const windows = result.timeline ?? [];
  if (windows.length === 0) {
    return null;
  }
  const headers = ['Window', 'At', 'FPS', 'p95', 'p99', 'Worst', 'Jank', 'RAM', 'CPU', 'JS alloc', 'Native main'];
  const rows = windows.map((window) => [
    window.label,
    `${Math.round(window.atMs / 1000)} s`,
    formatValue('number', window.frames?.fps?.average),
    formatValue('ms', window.frames?.frameTimeMs?.p95),
    formatValue('ms', window.frames?.frameTimeMs?.p99),
    formatValue('ms', window.frames?.frameTimeMs?.worst),
    formatValue('ratio', window.frames?.jankRatio),
    formatValue('mb', window.memory?.footprintMB),
    formatValue('pct', window.cpuPercent),
    formatValue('bytes', window.hermes?.allocatedBytes),
    formatValue('ms', window.native?.available ? window.native.mainThreadMs : null),
  ]);
  const first = windows[0];
  const last = windows[windows.length - 1];
  const drift = {
    fps: first.frames?.fps?.average != null && last.frames?.fps?.average != null ? last.frames.fps.average - first.frames.fps.average : null,
    memoryMB: first.memory?.footprintMB != null && last.memory?.footprintMB != null ? last.memory.footprintMB - first.memory.footprintMB : null,
  };
  return { table: markdownTable(headers, rows, ['left', ...headers.slice(1).map(() => 'right')]), drift };
}
