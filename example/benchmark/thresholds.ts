import type { FrameStatsSummary } from './frameStats';
import type { LagSummary } from './jsLagSampler';

/**
 * Pass/fail rules for the benchmark scenarios, expressed against
 * the display's own frame budget so the same rules apply at 60, 90 and 120 Hz.
 */
export interface EvaluationOptions {
  /** Also require the JS thread to keep up with the frame budget. */
  jsLag?: boolean;
}

export interface Evaluation {
  passed: boolean;
  failures: string[];
  budgetMs: number;
}

const WORST_FRAME_FACTOR = 3;
const P99_FACTOR = 1.5;
const MAX_JANK_RATIO = 0.01;
/**
 * A display link reports 16.67 ms frames with a little jitter either side of
 * the nominal interval, so a steady run has p50 and p95 fractionally above the
 * budget. Five percent covers that without hiding a real dropped frame.
 */
const PERCENTILE_TOLERANCE = 1.05;

function ms(value: number): string {
  return `${value.toFixed(2)} ms`;
}

export function evaluateFrameStats(
  frames: FrameStatsSummary,
  jsLag: LagSummary | null,
  options: EvaluationOptions = {},
): Evaluation {
  const budgetMs = 1000 / Math.max(1, frames.refreshRateHz);
  const failures: string[] = [];

  if (frames.frames === 0) {
    failures.push('no frames recorded');
  }
  const percentileLimit = budgetMs * PERCENTILE_TOLERANCE;
  if (frames.p50 > percentileLimit) {
    failures.push(`p50 ${ms(frames.p50)} > budget ${ms(percentileLimit)}`);
  }
  if (frames.p95 > percentileLimit) {
    failures.push(`p95 ${ms(frames.p95)} > budget ${ms(percentileLimit)}`);
  }
  if (frames.p99 > budgetMs * P99_FACTOR) {
    failures.push(`p99 ${ms(frames.p99)} > ${ms(budgetMs * P99_FACTOR)}`);
  }
  if (frames.max > budgetMs * WORST_FRAME_FACTOR) {
    failures.push(
      `worst frame ${ms(frames.max)} > ${ms(budgetMs * WORST_FRAME_FACTOR)}`,
    );
  }
  if (frames.jankRatio > MAX_JANK_RATIO) {
    failures.push(`jank ${(frames.jankRatio * 100).toFixed(2)}% > 1%`);
  }
  if (options.jsLag && jsLag != null && jsLag.p95 > percentileLimit) {
    failures.push(
      `JS lag p95 ${ms(jsLag.p95)} > budget ${ms(percentileLimit)}`,
    );
  }

  return { passed: failures.length === 0, failures, budgetMs };
}
