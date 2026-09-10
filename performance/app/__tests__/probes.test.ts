import { describe, expect, test } from 'bun:test';
import { setterSpans, summarizeProbes } from '../metrics/probes';

const drain = {
  dropped: 2,
  spans: [
    {
      name: 'markers.set',
      startNs: 100,
      durationNs: 2_000_000,
      count: 10_000,
      thread: 'main' as const,
    },
    {
      name: 'markers.fingerprint',
      startNs: 110,
      durationNs: 1_500_000,
      count: 10_000,
      thread: 'main' as const,
    },
    {
      name: 'markers.indexBuild',
      startNs: 3_000,
      durationNs: 8_000_000,
      count: 10_000,
      thread: 'background' as const,
    },
    {
      name: 'markers.applyDiff',
      startNs: 20_000,
      durationNs: 30_000_000,
      count: 800,
      thread: 'main' as const,
    },
    {
      name: 'markers.applyDiff',
      startNs: 60_000,
      durationNs: 10_000_000,
      count: 200,
      thread: 'main' as const,
    },
    {
      name: 'polylines.set',
      startNs: 90_000,
      durationNs: 500_000,
      count: 1000,
      thread: 'main' as const,
    },
  ],
};

describe('summarizeProbes', () => {
  test('aggregates by name and thread', () => {
    const summary = summarizeProbes(drain, true);
    expect(summary.available).toBe(true);
    expect(summary.dropped).toBe(2);
    expect(summary.spans).toBe(6);
    expect(summary.byName['markers.applyDiff'].count).toBe(2);
    expect(summary.byName['markers.applyDiff'].totalMs).toBe(40);
    expect(summary.byName['markers.applyDiff'].maxMs).toBe(30);
    expect(summary.byName['markers.applyDiff'].items).toBe(1000);
    expect(summary.byName['markers.indexBuild'].backgroundMs).toBe(8);
    expect(summary.mainThreadMs).toBeCloseTo(44, 5);
    expect(summary.backgroundMs).toBe(8);
  });

  test('setter spans are ordered by start', () => {
    expect(setterSpans(drain).map((span) => span.name)).toEqual([
      'markers.set',
      'polylines.set',
    ]);
  });

  test('missing drains are reported as unavailable', () => {
    const summary = summarizeProbes(null, false);
    expect(summary.available).toBe(false);
    expect(summary.spans).toBe(0);
  });
});
