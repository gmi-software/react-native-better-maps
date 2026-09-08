#!/usr/bin/env node
// Turns `[benchmark] {...}` lines from Metro, `simctl log stream` or `adb logcat`
// into a Markdown table. Usage: node example/scripts/benchmark-table.mjs <log>...
import { readFileSync } from 'node:fs';

const MARKER = '[benchmark] ';
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: benchmark-table.mjs <log file>...');
  process.exit(1);
}

const results = [];
for (const file of files) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const start = line.indexOf(MARKER);
    if (start < 0) {
      continue;
    }
    try {
      results.push(JSON.parse(line.slice(start + MARKER.length)));
    } catch {
      // A truncated line from a log buffer; skip it.
    }
  }
}

if (results.length === 0) {
  console.error('no [benchmark] lines found');
  process.exit(1);
}

const first = results[0];
const budget = 1000 / first.frames.refreshRateHz;
console.log(
  `Platform: ${first.platform} · provider: ${first.provider} · ${first.frames.refreshRateHz.toFixed(0)} Hz (budget ${budget.toFixed(2)} ms) · recorded ${first.recordedAt.slice(0, 10)}`,
);
console.log('');
console.log(
  '| Scenario | Result | FPS | p50 | p95 | p99 | Worst | Jank | JS lag p95 | RSS Δ |',
);
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const result of results) {
  const { frames, jsLag, memory, evaluation } = result;
  console.log(
    [
      result.id,
      evaluation.passed ? 'pass' : `fail (${evaluation.failures.length})`,
      frames.averageFps.toFixed(0),
      `${frames.p50.toFixed(1)} ms`,
      `${frames.p95.toFixed(1)} ms`,
      `${frames.p99.toFixed(1)} ms`,
      `${frames.max.toFixed(0)} ms`,
      `${(frames.jankRatio * 100).toFixed(1)} %`,
      `${jsLag.p95.toFixed(1)} ms`,
      `${memory.deltaMB >= 0 ? '+' : ''}${memory.deltaMB.toFixed(0)} MB`,
    ]
      .map((cell) => `| ${cell} `)
      .join('') + '|',
  );
}
const failed = results.filter((result) => !result.evaluation.passed);
if (failed.length > 0) {
  console.log('');
  for (const result of failed) {
    console.log(`- ${result.id}: ${result.evaluation.failures.join('; ')}`);
  }
}
