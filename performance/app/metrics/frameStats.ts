import type { FrameRecording } from '../../../example/modules/perf-lab';
import { FPS_WINDOW_MS, FRAME_BUDGET } from '../../perf.config';
import { distribution, mean, percentile, roundTo } from './stats';

export interface FrameHistogram {
  /** Upper edge of each bucket in ms; the last bucket is open-ended. */
  edgesMs: number[];
  counts: number[];
}

export interface FrameSummary {
  frames: number;
  durationMs: number;
  refreshRateHz: number;
  /** Median refresh interval the display actually ran at. */
  budgetMs: number;
  fps: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
    worstWindow: number;
    windows: number;
  };
  frameTimeMs: {
    average: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    worst: number;
    histogram: FrameHistogram;
  };
  /** Frames longer than 1.5× the interval the display was running at. */
  jankFrames: number;
  jankRatio: number;
  /** Refresh slots that passed without a frame, summed over the recording. */
  droppedFrames: number;
  /** Frames over 50 ms: a visible stall. */
  longFrames: number;
  overBudgetFrames: number;
  android?: {
    frames: number;
    renderTotalMs: {
      average: number;
      p50: number;
      p95: number;
      p99: number;
      worst: number;
    };
    phaseSharePct: Record<string, number>;
    phaseSumsMs: Record<string, number>;
    missedDeadline: number;
  };
}

const HISTOGRAM_EDGES_MS = [
  4, 8.33, 12, 16.67, 25, 33.33, 50, 100, 250, 500, 1000,
];

export function computeFrameSummary(recording: FrameRecording): FrameSummary {
  const { intervalsMs, expectedMs, refreshRateHz } = recording;
  const frames = intervalsMs.length;
  const sortedIntervals = [...intervalsMs].sort((a, b) => a - b);
  const sortedExpected = [...expectedMs].sort((a, b) => a - b);
  const budgetMs =
    sortedExpected.length > 0
      ? percentile(sortedExpected, 50)
      : 1000 / Math.max(1, refreshRateHz);

  let jankFrames = 0;
  let droppedFrames = 0;
  let longFrames = 0;
  let overBudgetFrames = 0;
  let totalMs = 0;
  const counts = new Array(HISTOGRAM_EDGES_MS.length + 1).fill(0);
  const windowFps: number[] = [];
  let windowMs = 0;
  let windowFrames = 0;

  for (let index = 0; index < frames; index += 1) {
    const interval = intervalsMs[index];
    const frameExpected = expectedMs[index] ?? budgetMs;
    totalMs += interval;
    if (interval > frameExpected * FRAME_BUDGET.jankFactor) {
      jankFrames += 1;
    }
    if (interval > FRAME_BUDGET.longFrameMs) {
      longFrames += 1;
    }
    if (interval > frameExpected * 1.05) {
      overBudgetFrames += 1;
    }
    droppedFrames += Math.max(0, Math.round(interval / frameExpected) - 1);

    let bucket = HISTOGRAM_EDGES_MS.findIndex((edge) => interval <= edge);
    if (bucket < 0) {
      bucket = HISTOGRAM_EDGES_MS.length;
    }
    counts[bucket] += 1;

    windowMs += interval;
    windowFrames += 1;
    if (windowMs >= FPS_WINDOW_MS) {
      windowFps.push((windowFrames * 1000) / windowMs);
      windowMs = 0;
      windowFrames = 0;
    }
  }
  if (windowFrames > 0 && windowMs > FPS_WINDOW_MS / 4) {
    windowFps.push((windowFrames * 1000) / windowMs);
  }
  const fpsSorted = [...windowFps].sort((a, b) => a - b);

  const summary: FrameSummary = {
    frames,
    durationMs: roundTo(recording.durationMs, 1),
    refreshRateHz,
    budgetMs: roundTo(budgetMs, 3),
    fps: {
      average: roundTo(totalMs > 0 ? (frames * 1000) / totalMs : 0, 1),
      p50: roundTo(percentile(fpsSorted, 50), 1),
      // Lower percentiles of the per-second FPS series are the bad seconds.
      p95: roundTo(percentile(fpsSorted, 5), 1),
      p99: roundTo(percentile(fpsSorted, 1), 1),
      worstWindow: roundTo(fpsSorted.length > 0 ? fpsSorted[0] : 0, 1),
      windows: fpsSorted.length,
    },
    frameTimeMs: {
      average: roundTo(mean(sortedIntervals), 2),
      p50: roundTo(percentile(sortedIntervals, 50), 2),
      p90: roundTo(percentile(sortedIntervals, 90), 2),
      p95: roundTo(percentile(sortedIntervals, 95), 2),
      p99: roundTo(percentile(sortedIntervals, 99), 2),
      worst: roundTo(
        sortedIntervals.length > 0
          ? sortedIntervals[sortedIntervals.length - 1]
          : 0,
        2,
      ),
      histogram: { edgesMs: HISTOGRAM_EDGES_MS, counts },
    },
    jankFrames,
    jankRatio: roundTo(frames > 0 ? jankFrames / frames : 0, 4),
    droppedFrames,
    longFrames,
    overBudgetFrames,
  };

  if (recording.android) {
    const android = recording.android;
    const render = distribution(android.totalMs);
    const sums = android.phaseSumsMs;
    const total = sums.total > 0 ? sums.total : 1;
    const share: Record<string, number> = {};
    const sumsRounded: Record<string, number> = {};
    for (const [phase, value] of Object.entries(sums)) {
      if (phase !== 'total') {
        share[phase] = roundTo((value / total) * 100, 1);
      }
      sumsRounded[phase] = roundTo(value, 1);
    }
    summary.android = {
      frames: android.frames,
      renderTotalMs: {
        average: roundTo(render.average, 2),
        p50: roundTo(render.p50, 2),
        p95: roundTo(render.p95, 2),
        p99: roundTo(render.p99, 2),
        worst: roundTo(render.max, 2),
      },
      phaseSharePct: share,
      phaseSumsMs: sumsRounded,
      missedDeadline: android.missedDeadline,
    };
  }

  return summary;
}
