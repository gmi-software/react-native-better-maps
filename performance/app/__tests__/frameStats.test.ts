import { describe, expect, test } from 'bun:test';
import { computeFrameSummary } from '../metrics/frameStats';

function recording(intervalsMs: number[], expected = 16.67) {
  return {
    intervalsMs,
    expectedMs: intervalsMs.map(() => expected),
    durationMs: intervalsMs.reduce((sum, value) => sum + value, 0),
    refreshRateHz: 60,
    startNs: 0,
  };
}

describe('computeFrameSummary', () => {
  test('percentiles, jank, dropped and long frames', () => {
    const intervals = [...Array(10).fill(16.7), 60, ...Array(5).fill(16.7)];
    const summary = computeFrameSummary(recording(intervals));
    expect(summary.frames).toBe(16);
    expect(summary.frameTimeMs.worst).toBe(60);
    expect(summary.frameTimeMs.p50).toBe(16.7);
    expect(summary.jankFrames).toBe(1);
    expect(summary.longFrames).toBe(1);
    expect(summary.droppedFrames).toBe(3);
    expect(summary.budgetMs).toBeCloseTo(16.67, 2);
    const histogramTotal = summary.frameTimeMs.histogram.counts.reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(histogramTotal).toBe(16);
  });

  test('per-second FPS windows expose bad seconds', () => {
    const good = Array(120).fill(16.67); // ~2 s at 60 fps
    const bad = [...Array(20).fill(16.67), 500, 200]; // one bad second
    const summary = computeFrameSummary(recording([...good, ...bad, ...good]));
    expect(summary.fps.windows).toBeGreaterThanOrEqual(4);
    expect(summary.fps.average).toBeLessThan(60);
    expect(summary.fps.worstWindow).toBeLessThan(30);
    expect(summary.fps.p50).toBeGreaterThan(55);
  });

  test('120 Hz frames are judged against their own interval', () => {
    const summary = computeFrameSummary(recording(Array(50).fill(8.33), 8.33));
    expect(summary.jankFrames).toBe(0);
    expect(summary.fps.average).toBeCloseTo(120, 0);
    expect(summary.budgetMs).toBeCloseTo(8.33, 2);
  });

  test('empty recording is safe', () => {
    const summary = computeFrameSummary(recording([]));
    expect(summary.frames).toBe(0);
    expect(summary.fps.average).toBe(0);
    expect(summary.frameTimeMs.p95).toBe(0);
  });
});
