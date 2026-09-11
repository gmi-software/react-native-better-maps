#!/usr/bin/env python3
"""Extract callback-interval diagnostics; these are NOT presented map FPS."""
import argparse
import json
import math
from pathlib import Path


def percentile(values, fraction):
    if not values:
        raise ValueError('No frame samples recorded')
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def summarize(row):
    intervals = row['intervalsMs']
    expected = row['expectedMs']
    if not intervals or len(intervals) != len(expected):
        raise ValueError('Missing or misaligned callback samples')
    if any(not math.isfinite(value) or value <= 0 for value in intervals + expected):
        raise ValueError('Invalid frame timing')
    # Show actual intervals separately from adaptive deadline diagnostics.
    late = sum(actual > deadline * 1.05 for actual, deadline in zip(intervals, expected))
    return {
        'mode': row['mode'], 'count': row['count'], 'pass': row['pass'],
        'samples': len(intervals), 'reportedMaximumHz': row['refreshRateHz'],
        'callbackRateHz': 1000 * len(intervals) / sum(intervals),
        'p50Ms': percentile(intervals, .50), 'p95Ms': percentile(intervals, .95),
        'p99Ms': percentile(intervals, .99), 'maxMs': max(intervals),
        'lateCallbackPercent': 100 * late / len(intervals),
        'intervalsWithin120HzBudgetPercent': 100 * sum(value <= (1000 / 120) * 1.05 for value in intervals) / len(intervals),
        'memoryDeltaMiB': (row['afterBytes'] - row['beforeBytes']) / (1024 ** 2),
        'measurement': 'main-thread display callback intervals; not map/GPU presentation',
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('log', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--suite', choices=['primary', 'control', 'selected'])
    parser.add_argument('--workload-version', type=int)
    args = parser.parse_args()
    rows = []
    for line in args.log.read_text(errors='replace').splitlines():
        marker = '[marker-view-benchmark] '
        if marker not in line:
            continue
        payload = line.split(marker, 1)[1].strip()
        if payload.startswith('{'):
            row = json.loads(payload)
            if args.workload_version is not None and row.get('workloadVersion') != args.workload_version:
                continue
            if args.suite is None or row.get('suite', 'primary') == args.suite:
                rows.append(row)
    if not rows:
        raise SystemExit('No complete marker benchmark rows found')
    if any(row.get('workloadVersion', 1) >= 3 and not row.get('cameraRouteCompleted') for row in rows):
        raise SystemExit('Camera route validation failed; do not summarize as completed motion')
    summary = [summarize(row) for row in rows]
    # Keep raw sample arrays compact so the review diff is not tens of thousands
    # of lines of numbers; the human-readable summary remains expanded.
    raw_json = ',\n'.join(json.dumps(row, separators=(',', ':')) for row in rows)
    args.output.write_text('{"raw":[\n' + raw_json + '\n],"summary":' + json.dumps(summary, indent=2) + '}\n')
    print('| Mode | Count | Pass | Callback Hz | p95 ms | p99 ms | Late % |')
    print('|---|---:|---:|---:|---:|---:|---:|')
    for row in summary:
        print(f"| {row['mode']} | {row['count']} | {row['pass'] + 1} | {row['callbackRateHz']:.1f} | {row['p95Ms']:.2f} | {row['p99Ms']:.2f} | {row['lateCallbackPercent']:.2f} |")


if __name__ == '__main__':
    main()
