import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RESULTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'results', 'bench');

export interface Measurement {
  name: string;
  n: number;
  iterations: number;
  medianMs: number;
  meanMs: number;
  minMs: number;
  p95Ms: number;
  /** Optional payload the benchmark wants to record (bytes, counts). */
  extra?: Record<string, number>;
}

let sinkValue = 0;

/** Keeps results observable so the JIT cannot eliminate the measured work. */
function sink(value: unknown): void {
  if (Array.isArray(value)) {
    sinkValue += value.length;
  } else if (typeof value === 'number') {
    sinkValue += value;
  } else if (value != null) {
    sinkValue += 1;
  }
}

export function sinkTotal(): number {
  return sinkValue;
}

function percentile(sorted: number[], p: number): number {
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

/**
 * Times `fn` after warm-up. Iteration count adapts so tiny operations are
 * sampled often and 100k-element operations only a few times.
 */
export function measure(
  name: string,
  n: number,
  fn: () => unknown,
  options: { iterations?: number; warmup?: number; extra?: Record<string, number> } = {},
): Measurement {
  const iterations = options.iterations ?? Math.max(10, Math.min(200, Math.round(2_000_000 / Math.max(n, 1))));
  const warmup = options.warmup ?? Math.min(5, iterations);
  for (let index = 0; index < warmup; index += 1) {
    sink(fn());
  }
  const samples: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    sink(fn());
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return {
    name,
    n,
    iterations,
    medianMs: percentile(samples, 50),
    meanMs: mean,
    minMs: samples[0],
    p95Ms: percentile(samples, 95),
    extra: options.extra,
  };
}

/** Least-squares slope of log(ms) vs log(n): 1 ≈ linear, 2 ≈ quadratic. */
export function fitExponent(measurements: Measurement[]): number | null {
  const usable = measurements.filter((entry) => entry.n > 0 && entry.medianMs > 0);
  if (usable.length < 2) {
    return null;
  }
  const xs = usable.map((entry) => Math.log(entry.n));
  const ys = usable.map((entry) => Math.log(entry.medianMs));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    numerator += (xs[index] - meanX) * (ys[index] - meanY);
    denominator += (xs[index] - meanX) ** 2;
  }
  return denominator === 0 ? null : numerator / denominator;
}

export interface BenchReport {
  suite: string;
  runtime: string;
  recordedAt: string;
  series: { name: string; exponent: number | null; measurements: Measurement[] }[];
}

function format(value: number): string {
  if (value >= 100) {
    return value.toFixed(0);
  }
  if (value >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(3);
}

/** Prints a table per series and writes the JSON report under results/bench. */
export function report(suite: string, series: Record<string, Measurement[]>): BenchReport {
  const out: BenchReport = {
    suite,
    runtime: `bun ${process.versions.bun ?? ''} on ${process.platform}/${process.arch}`,
    recordedAt: new Date().toISOString(),
    series: Object.entries(series).map(([name, measurements]) => ({
      name,
      exponent: fitExponent(measurements),
      measurements,
    })),
  };
  const lines: string[] = [`\n## ${suite} (${out.runtime})`];
  for (const entry of out.series) {
    lines.push(`\n### ${entry.name}  (scaling exponent ${entry.exponent == null ? 'N/A' : entry.exponent.toFixed(2)})`);
    lines.push('| n | median ms | mean ms | p95 ms | per item µs | extra |');
    lines.push('| ---: | ---: | ---: | ---: | ---: | --- |');
    for (const measurement of entry.measurements) {
      const extra = measurement.extra
        ? Object.entries(measurement.extra)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ')
        : '';
      lines.push(
        `| ${measurement.n} | ${format(measurement.medianMs)} | ${format(measurement.meanMs)} | ${format(measurement.p95Ms)} | ${format((measurement.medianMs * 1000) / Math.max(measurement.n, 1))} | ${extra} |`,
      );
    }
  }
  console.log(lines.join('\n'));
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(path.join(RESULTS_DIR, `${suite}.json`), `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

export const SIZES = [100, 1000, 10_000, 100_000];
