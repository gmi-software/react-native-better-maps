import { percentile } from './frameStats';

/** How late timer callbacks fire on the JS thread, in ms. */
export interface LagSummary {
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export interface LagSampler {
  stop(): LagSummary;
}

/**
 * Measures JS-thread stalls: a timer is re-armed every `intervalMs`, and the
 * amount by which it fires late is the time the JS thread was busy with
 * something else, such as serializing a marker array during a commit.
 */
export function startJsLagSampler(intervalMs = 16): LagSampler {
  const samples: number[] = [];
  let expectedAt = performance.now() + intervalMs;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    const now = performance.now();
    samples.push(Math.max(0, now - expectedAt));
    expectedAt = now + intervalMs;
    timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);

  return {
    stop() {
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        samples: sorted.length,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      };
    },
  };
}
