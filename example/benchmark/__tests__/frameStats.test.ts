import { describe, expect, test } from 'bun:test';
import { computeFrameStats, percentile } from '../frameStats';

function recording(intervalsMs: number[], expectedMs = 16.667) {
  return {
    intervalsMs,
    expectedMs: intervalsMs.map(() => expectedMs),
    durationMs: intervalsMs.reduce((sum, value) => sum + value, 0),
    refreshRateHz: 1000 / expectedMs,
  };
}

describe('percentile', () => {
  test('uses nearest rank', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(sorted, 50)).toBe(5);
    expect(percentile(sorted, 90)).toBe(9);
    expect(percentile(sorted, 99)).toBe(10);
  });

  test('returns 0 for an empty sample', () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe('computeFrameStats', () => {
  test('a steady recording has no jank', () => {
    const stats = computeFrameStats(recording(Array(120).fill(16.667)));
    expect(stats.frames).toBe(120);
    expect(stats.jankFrames).toBe(0);
    expect(stats.droppedFrames).toBe(0);
    expect(stats.averageFps).toBeCloseTo(60, 0);
    expect(stats.p99).toBeCloseTo(16.667, 3);
  });

  test('a long frame counts as jank and as dropped refresh slots', () => {
    const intervals = [...Array(99).fill(16.667), 50];
    const stats = computeFrameStats(recording(intervals));
    expect(stats.jankFrames).toBe(1);
    expect(stats.jankRatio).toBeCloseTo(0.01, 5);
    expect(stats.droppedFrames).toBe(2);
    expect(stats.max).toBe(50);
    // Nearest rank: over 100 samples p99 is the 99th value, the outlier is only in max.
    expect(stats.p99).toBeCloseTo(16.667, 3);
    expect(stats.p95).toBeCloseTo(16.667, 3);
  });

  test('p99 catches an outlier in a short recording', () => {
    const stats = computeFrameStats(recording([...Array(9).fill(16.667), 50]));
    expect(stats.p99).toBe(50);
    expect(stats.p95).toBe(50);
    expect(stats.p90).toBeCloseTo(16.667, 3);
    expect(stats.p50).toBeCloseTo(16.667, 3);
  });

  test('jank is judged against the interval the display ran at', () => {
    const stats = computeFrameStats({
      intervalsMs: [8.33, 8.33, 16.67, 33.3],
      expectedMs: [8.33, 8.33, 16.67, 16.67],
      durationMs: 67,
      refreshRateHz: 120,
    });
    expect(stats.jankFrames).toBe(1);
    expect(stats.droppedFrames).toBe(1);
  });

  test('handles an empty recording', () => {
    const stats = computeFrameStats(recording([]));
    expect(stats.frames).toBe(0);
    expect(stats.averageFps).toBe(0);
    expect(stats.expectedMs).toBeCloseTo(16.667, 3);
  });
});
