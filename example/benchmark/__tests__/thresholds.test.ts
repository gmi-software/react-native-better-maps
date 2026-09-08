import { describe, expect, test } from 'bun:test';
import type { FrameStatsSummary } from '../frameStats';
import { evaluateFrameStats } from '../thresholds';

function summary(
  overrides: Partial<FrameStatsSummary> = {},
): FrameStatsSummary {
  return {
    frames: 600,
    durationMs: 5000,
    refreshRateHz: 120,
    expectedMs: 8.333,
    averageFps: 120,
    p50: 8.3,
    p90: 8.3,
    p95: 8.3,
    p99: 8.4,
    max: 12,
    jankFrames: 0,
    jankRatio: 0,
    droppedFrames: 0,
    ...overrides,
  };
}

describe('evaluateFrameStats', () => {
  test('passes a clean 120 Hz recording', () => {
    const result = evaluateFrameStats(summary(), null);
    expect(result.passed).toBe(true);
    expect(result.budgetMs).toBeCloseTo(8.333, 3);
  });

  test('scales the budget with the refresh rate', () => {
    const result = evaluateFrameStats(
      summary({ refreshRateHz: 60, p50: 16, p95: 16.5, p99: 20, max: 40 }),
      null,
    );
    expect(result.passed).toBe(true);
  });

  test('tolerates display-link jitter around the budget', () => {
    const result = evaluateFrameStats(
      summary({
        refreshRateHz: 60,
        expectedMs: 16.667,
        p50: 16.7,
        p95: 16.9,
        p99: 17,
        max: 30,
      }),
      null,
    );
    expect(result.passed).toBe(true);
  });

  test('fails on p95 above the budget', () => {
    const result = evaluateFrameStats(summary({ p95: 9 }), null);
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('p95');
  });

  test('fails on a worst frame above three budgets', () => {
    const result = evaluateFrameStats(summary({ max: 26 }), null);
    expect(result.failures.some((f) => f.includes('worst frame'))).toBe(true);
  });

  test('fails on more than one percent jank', () => {
    const result = evaluateFrameStats(
      summary({ jankFrames: 12, jankRatio: 0.02 }),
      null,
    );
    expect(result.failures.some((f) => f.includes('jank'))).toBe(true);
  });

  test('only checks JS lag when asked', () => {
    const lag = { samples: 100, p50: 1, p95: 20, p99: 30, max: 40 };
    expect(evaluateFrameStats(summary(), lag).passed).toBe(true);
    expect(evaluateFrameStats(summary(), lag, { jsLag: true }).passed).toBe(
      false,
    );
  });

  test('fails an empty recording', () => {
    const result = evaluateFrameStats(summary({ frames: 0 }), null);
    expect(result.failures).toContain('no frames recorded');
  });
});
