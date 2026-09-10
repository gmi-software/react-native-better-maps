/** Nearest-rank percentile over an ascending sample. */
export function percentile(sortedAscending: number[], p: number): number {
  if (sortedAscending.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const index = Math.min(sortedAscending.length - 1, Math.max(0, rank - 1));
  return sortedAscending[index];
}

export function median(values: number[]): number {
  return percentile(
    [...values].sort((a, b) => a - b),
    50,
  );
}

export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
}

export interface Distribution {
  samples: number;
  average: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
  min: number;
}

export function distribution(values: number[]): Distribution {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    average: mean(sorted),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
    min: sorted.length > 0 ? sorted[0] : 0,
  };
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
