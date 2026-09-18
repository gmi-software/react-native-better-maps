import { Platform } from 'react-native';
import type { MapProvider } from 'react-native-better-maps';
import {
  displayRefreshRateHz,
  logBenchmarkLine,
  memoryFootprintBytes,
  startFrameRecording,
  stopFrameRecording,
} from '../modules/frame-stats';
import { computeFrameStats, type FrameStatsSummary } from './frameStats';
import { startJsLagSampler, type LagSummary } from './jsLagSampler';
import type { BenchmarkScenario, ScenarioContext } from './scenarios';
import { evaluateFrameStats, type Evaluation } from './thresholds';

export interface ScenarioResult {
  id: string;
  name: string;
  platform: string;
  provider: MapProvider;
  recordedAt: string;
  frames: FrameStatsSummary;
  jsLag: LagSummary;
  memory: { beforeMB: number; afterMB: number; deltaMB: number };
  evaluation: Evaluation;
}

export interface RunOptions {
  provider: MapProvider;
  /** Mounts the scenario's map and resolves once `onMapReady` fired. */
  mount(scenario: BenchmarkScenario): Promise<void>;
  context: ScenarioContext;
  onStatus?(message: string): void;
}

const MB = 1024 * 1024;

/** Mounts, settles, records, scripts and evaluates one scenario. */
export async function runScenario(
  scenario: BenchmarkScenario,
  options: RunOptions,
): Promise<ScenarioResult> {
  options.onStatus?.(`${scenario.name}: mounting`);
  await options.mount(scenario);
  await options.context.sleep(scenario.settleMs ?? 1500);

  const beforeBytes = await memoryFootprintBytes();
  options.onStatus?.(`${scenario.name}: recording`);
  const lag = startJsLagSampler();
  await startFrameRecording();
  try {
    await scenario.run(options.context);
  } catch (error) {
    await stopFrameRecording().catch(() => undefined);
    lag.stop();
    throw error;
  }

  const recording = await stopFrameRecording();
  const jsLag = lag.stop();
  const afterBytes = await memoryFootprintBytes();
  const refreshRateHz =
    recording.refreshRateHz || (await displayRefreshRateHz());
  const frames = computeFrameStats({ ...recording, refreshRateHz });
  const evaluation = evaluateFrameStats(frames, jsLag, {
    jsLag: scenario.checkJsLag,
  });
  const result: ScenarioResult = {
    id: scenario.id,
    name: scenario.name,
    platform: Platform.OS,
    provider: options.provider,
    recordedAt: new Date().toISOString(),
    frames,
    jsLag,
    memory: {
      beforeMB: beforeBytes / MB,
      afterMB: afterBytes / MB,
      deltaMB: (afterBytes - beforeBytes) / MB,
    },
    evaluation,
  };
  await publishResult(result);
  return result;
}

/** One JSON line per result: Metro output in debug, the system log always. */
export async function publishResult(result: ScenarioResult): Promise<void> {
  const line = `[benchmark] ${JSON.stringify(result)}`;
  console.log(line);
  await logBenchmarkLine(line).catch(() => undefined);
}

/** One line per scenario, for the on-screen table and for log grepping. */
export function formatResultLine(result: ScenarioResult): string {
  const { frames, jsLag, memory, evaluation } = result;
  const verdict = evaluation.passed ? 'PASS' : 'FAIL';
  return [
    `${verdict} ${result.id}`,
    `fps ${frames.averageFps.toFixed(0)}`,
    `p50 ${frames.p50.toFixed(1)}`,
    `p95 ${frames.p95.toFixed(1)}`,
    `p99 ${frames.p99.toFixed(1)}`,
    `max ${frames.max.toFixed(0)}`,
    `jank ${(frames.jankRatio * 100).toFixed(1)}%`,
    `js p95 ${jsLag.p95.toFixed(1)}`,
    `mem ${memory.deltaMB >= 0 ? '+' : ''}${memory.deltaMB.toFixed(0)}MB`,
  ].join(' · ');
}
