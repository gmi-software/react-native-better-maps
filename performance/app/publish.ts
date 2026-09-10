import { logLine, writeResultFile } from '../../example/modules/perf-lab';
import { base64 } from './base64';
import type { RunFile, ScenarioResult } from './result';
import { summaryLine } from './result';

export const LOG_PREFIX = '[perf-lab]';

/** One `[perf-lab] {...}` line in the system log (and Metro in dev). */
export async function emit(event: Record<string, unknown>): Promise<void> {
  const line = `${LOG_PREFIX} ${JSON.stringify(event)}`;
  if (__DEV__) {
    console.log(line);
  }
  await logLine(line).catch(() => undefined);
}

export async function publishScenarioResult(
  result: ScenarioResult,
): Promise<void> {
  await emit({
    event: 'scenario-result',
    runId: result.runId,
    ...summaryLine(result),
  });
}

const CHUNK_CHARS = 600;

/**
 * Writes the run file for the CLI to pull and, as a fallback for devices
 * whose file system the CLI cannot reach, streams it through the log in
 * base64 chunks that stay under the platform log line limits.
 */
export async function publishRunFile(run: RunFile): Promise<string> {
  const json = JSON.stringify(run);
  let path = '';
  try {
    path = await writeResultFile(`${run.runId}.json`, json);
  } catch (error) {
    await emit({
      event: 'error',
      runId: run.runId,
      message: `writeResultFile failed: ${String(error)}`,
    });
  }
  const total = Math.ceil(json.length / CHUNK_CHARS);
  for (let index = 0; index < total; index += 1) {
    await emit({
      event: 'result-chunk',
      runId: run.runId,
      index,
      total,
      data: base64(json.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS)),
    });
  }
  await emit({
    event: 'run-complete',
    runId: run.runId,
    file: path,
    scenarios: run.results.length,
    failures: run.failures.length,
  });
  return path;
}
