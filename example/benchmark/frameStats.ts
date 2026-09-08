import type { FrameRecording } from '../modules/frame-stats';

/** Percentiles and jank counts derived from one recording. */
export interface FrameStatsSummary {
  frames: number;
  durationMs: number;
  refreshRateHz: number;
  /** Median refresh interval the display ran at during the recording. */
  expectedMs: number;
  averageFps: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  /** Frames longer than 1.5× the interval the display was running at. */
  jankFrames: number;
  jankRatio: number;
  /** Refresh slots that passed without a frame, summed over the recording. */
  droppedFrames: number;
}

/** Nearest-rank percentile over a sorted ascending sample. */
export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
  return sortedAscending[index];
}

export const JANK_THRESHOLD_FACTOR = 1.5;

export function computeFrameStats(
  recording: FrameRecording,
): FrameStatsSummary {
  const { intervalsMs, expectedMs, refreshRateHz } = recording;
  const frames = intervalsMs.length;
  const sortedIntervals = [...intervalsMs].sort((a, b) => a - b);
  const sortedExpected = [...expectedMs].sort((a, b) => a - b);
  const expected =
    sortedExpected.length > 0
      ? percentile(sortedExpected, 50)
      : 1000 / Math.max(1, refreshRateHz);

  let jankFrames = 0;
  let droppedFrames = 0;
  let totalMs = 0;
  for (let index = 0; index < frames; index += 1) {
    const interval = intervalsMs[index];
    const frameExpected = expectedMs[index] ?? expected;
    totalMs += interval;
    if (interval > frameExpected * JANK_THRESHOLD_FACTOR) {
      jankFrames += 1;
    }
    droppedFrames += Math.max(0, Math.round(interval / frameExpected) - 1);
  }

  return {
    frames,
    durationMs: recording.durationMs,
    refreshRateHz,
    expectedMs: expected,
    averageFps: totalMs > 0 ? (frames * 1000) / totalMs : 0,
    p50: percentile(sortedIntervals, 50),
    p90: percentile(sortedIntervals, 90),
    p95: percentile(sortedIntervals, 95),
    p99: percentile(sortedIntervals, 99),
    max:
      sortedIntervals.length > 0
        ? sortedIntervals[sortedIntervals.length - 1]
        : 0,
    jankFrames,
    jankRatio: frames > 0 ? jankFrames / frames : 0,
    droppedFrames,
  };
}
