/**
 * Performance lab configuration shared by the in-app runner and the CLI.
 *
 * Regression thresholds are deliberately conservative and, until the
 * baselines on real devices are proven stable across repeated runs, the
 * `check` command only fails a run when invoked with `--fail`. See
 * performance/README.md, "Regression detection".
 */

export interface RegressionThresholds {
  /** Average FPS drop, in percent of the baseline, that counts as a regression. */
  fpsDropPct: number;
  /** p95 frame-time increase, in percent. */
  p95FrameTimeIncreasePct: number;
  /** p99 frame-time increase, in percent. */
  p99FrameTimeIncreasePct: number;
  /** Memory after interaction increase, in percent. */
  memoryIncreasePct: number;
  /** JS commit time increase (average per commit), in percent. */
  jsCommitIncreasePct: number;
  /** Native setter time increase, in percent. */
  nativeSetterIncreasePct: number;
  /** Jank ratio increase, in absolute percentage points. */
  jankRatioIncreasePoints: number;
  /** Ignore differences smaller than this many milliseconds (noise floor). */
  minAbsoluteMs: number;
}

export const REGRESSION_THRESHOLDS: RegressionThresholds = {
  fpsDropPct: 5,
  p95FrameTimeIncreasePct: 5,
  p99FrameTimeIncreasePct: 10,
  memoryIncreasePct: 10,
  jsCommitIncreasePct: 10,
  nativeSetterIncreasePct: 10,
  jankRatioIncreasePoints: 1,
  minAbsoluteMs: 0.5,
};

/**
 * Suites map a name to scenario selectors (ids, groups, `tag:` or `prefix*`).
 * `baseline` is what `bun perf baseline` records.
 */
export const SUITES: Record<string, string[]> = {
  quick: ['tag:quick'],
  baseline: ['tag:baseline'],
  full: ['tag:baseline', 'tag:heavy', 'stability-15m'],
  markers: ['markers'],
  camera: ['camera'],
  mutations: ['mutations'],
  geometry: ['geometry'],
  clustering: ['clustering'],
  combined: ['combined'],
  stability: ['stability'],
};

/** Frame budgets per refresh rate; frames longer than `jankFactor` × budget are jank. */
export const FRAME_BUDGET = {
  jankFactor: 1.5,
  longFrameMs: 50,
};

/** Window length used to derive FPS percentiles ("worst second"). */
export const FPS_WINDOW_MS = 1000;
