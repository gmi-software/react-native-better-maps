import { describe, expect, test } from 'bun:test';
import {
  checkRegressions,
  compareRuns,
  fitExponent,
  formatOverview,
  stepsTable,
} from '../lib/compare.mjs';
import { improvementPct, metric } from '../lib/metrics.mjs';
import { REGRESSION_THRESHOLDS } from '../../perf.config';

function result(overrides: Record<string, unknown>) {
  return {
    scenario: 'markers-10k',
    frames: {
      fps: { average: 58, p95: 40 },
      frameTimeMs: { p50: 16.7, p95: 33, p99: 50, worst: 120 },
      jankRatio: 0.04,
      longFrames: 2,
    },
    js: {
      lagMs: { p95: 2 },
      busyRatio: 0.02,
      commits: { count: 1, avgMs: 40, maxMs: 40 },
    },
    load: { commitMs: 60, readyMs: 1500 },
    native: { available: true, mainThreadMs: 300, backgroundMs: 50 },
    bridge: { setterMs: { avgMs: 5 }, commitToNativeMs: { avgMs: 8 } },
    memory: {
      afterInteractionMB: 200,
      interactionDeltaMB: 10,
      retainedAfterCleanupMB: 5,
    },
    allocations: {
      hermes: { allocatedBytes: 1000, gcCount: 1 },
      android: null,
      ios: null,
    },
    cpu: { percent: 50 },
    steps: [],
    timeline: [],
    ...overrides,
  };
}

function run(results: ReturnType<typeof result>[]) {
  return {
    run: {},
    results: new Map(results.map((entry) => [entry.scenario, entry])),
  };
}

describe('compare', () => {
  test('improvement percentage is oriented so positive is better', () => {
    expect(improvementPct(metric('fps'), 50, 55)).toBeCloseTo(10, 5);
    expect(improvementPct(metric('p95'), 20, 22)).toBeCloseTo(-10, 5);
    expect(improvementPct(metric('p95'), 20, 20.2, 0.5)).toBe(0);
    expect(improvementPct(metric('p95'), null, 20)).toBeNull();
  });

  test('regressions beyond thresholds are reported, N/A is skipped', () => {
    const baseline = run([result({})]);
    const current = run([
      result({
        frames: {
          fps: { average: 50, p95: 40 },
          frameTimeMs: { p50: 16.7, p95: 40, p99: 50, worst: 120 },
          jankRatio: 0.06,
          longFrames: 2,
        },
        native: { available: false },
        bridge: { setterMs: null, commitToNativeMs: null },
      }),
    ]);
    const comparison = compareRuns(baseline, current, { minAbsoluteMs: 0.5 });
    const verdict = checkRegressions(comparison, REGRESSION_THRESHOLDS);
    const keys = verdict.regressions.map((entry) => entry.metric).sort();
    expect(keys).toEqual(['fps', 'jank', 'p95']);
    expect(verdict.skipped.map((entry) => entry.metric)).toContain('setter');
    expect(formatOverview(comparison)).toContain('markers-10k');
    expect(formatOverview(comparison)).toContain('N/A');
  });

  test('scenarios missing from the baseline are listed', () => {
    const comparison = compareRuns(run([]), run([result({})]), {});
    expect(comparison.missing).toEqual(['markers-10k']);
  });
});

describe('scaling fit', () => {
  test('linear and quadratic series', () => {
    expect(
      fitExponent([
        { n: 100, ms: 1 },
        { n: 1000, ms: 10 },
        { n: 10000, ms: 100 },
      ]),
    ).toBeCloseTo(1, 5);
    expect(
      fitExponent([
        { n: 100, ms: 1 },
        { n: 1000, ms: 100 },
        { n: 10000, ms: 10000 },
      ]),
    ).toBeCloseTo(2, 5);
    expect(fitExponent([{ n: 100, ms: 1 }])).toBeNull();
  });

  test('steps table aggregates repeats by label', () => {
    const step = (label: string, changed: number, avgMs: number) => ({
      label,
      meta: { changed },
      commits: { count: 1, avgMs },
      bridge: { setterMs: { avgMs: 1 }, commitToNativeMs: { avgMs: 2 } },
      native: { byName: { 'markers.set': { totalMs: 3 } } },
      hermes: { allocatedBytes: 10 },
    });
    const table = stepsTable(
      result({
        steps: [
          step('update-1', 1, 40),
          step('update-1', 1, 42),
          step('update-100', 100, 41),
        ],
      }),
    );
    expect(table.table).toContain('update-1');
    expect(table.table).toContain('update-100');
    expect(table.exponent).toBeCloseTo(0, 1);
  });
});
