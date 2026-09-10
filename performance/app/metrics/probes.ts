import type { ProbeDrain, ProbeSpan } from '../../../example/modules/perf-lab';
import { distribution, roundTo } from './stats';

export interface ProbeStat {
  count: number;
  totalMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  mainThreadMs: number;
  backgroundMs: number;
  /** Sum of the `count` payloads (items processed) across spans. */
  items: number;
}

export interface ProbeSummary {
  available: boolean;
  dropped: number;
  spans: number;
  /** Time spent on the main (UI) thread inside instrumented library code. */
  mainThreadMs: number;
  backgroundMs: number;
  byName: Record<string, ProbeStat>;
}

export function summarizeProbes(
  drain: ProbeDrain | null,
  available: boolean,
): ProbeSummary {
  const byName: Record<string, ProbeStat> = {};
  let mainThreadMs = 0;
  let backgroundMs = 0;
  const spans = drain?.spans ?? [];
  const grouped = new Map<string, ProbeSpan[]>();
  for (const span of spans) {
    let list = grouped.get(span.name);
    if (list == null) {
      list = [];
      grouped.set(span.name, list);
    }
    list.push(span);
  }
  for (const [name, list] of grouped) {
    const durations = list.map((span) => span.durationNs / 1e6);
    const stats = distribution(durations);
    let main = 0;
    let background = 0;
    let items = 0;
    for (const span of list) {
      const ms = span.durationNs / 1e6;
      if (span.thread === 'main') {
        main += ms;
      } else {
        background += ms;
      }
      items += span.count;
    }
    mainThreadMs += main;
    backgroundMs += background;
    byName[name] = {
      count: list.length,
      totalMs: roundTo(main + background, 2),
      avgMs: roundTo(stats.average, 3),
      p50Ms: roundTo(stats.p50, 3),
      p95Ms: roundTo(stats.p95, 3),
      maxMs: roundTo(stats.max, 3),
      mainThreadMs: roundTo(main, 2),
      backgroundMs: roundTo(background, 2),
      items,
    };
  }
  return {
    available,
    dropped: drain?.dropped ?? 0,
    spans: spans.length,
    mainThreadMs: roundTo(mainThreadMs, 2),
    backgroundMs: roundTo(backgroundMs, 2),
    byName,
  };
}

/** Spans whose name is a `*.set` prop setter, in start order. */
export function setterSpans(drain: ProbeDrain | null): ProbeSpan[] {
  return (drain?.spans ?? [])
    .filter((span) => span.name.endsWith('.set'))
    .sort((a, b) => a.startNs - b.startNs);
}
