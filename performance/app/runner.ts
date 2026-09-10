import type { Camera, MapViewRef } from 'react-native-better-maps';
import {
  drainProbes,
  jsQueueProbeAvailable,
  memorySnapshot,
  nowNs,
  processStats,
  setProbesEnabled,
  startFrameRecording,
  startJsQueueProbe,
  stopFrameRecording,
  stopJsQueueProbe,
  type DeviceInfo,
  type FrameRecording,
  type MemorySnapshot,
  type ProbeSpan,
} from '../../example/modules/perf-lab';
import { clearFixtureCache } from '../fixtures';
import type {
  CommitSample,
  PerfMapProps,
  Scenario,
  ScenarioContext,
  StepMeta,
} from '../scenarios/types';
import { computeFrameSummary } from './metrics/frameStats';
import {
  hermesDelta,
  readHermesStats,
  type HermesStats,
} from './metrics/hermes';
import { startJsThreadRecorder, withJsQueueProbe } from './metrics/jsThread';
import {
  memoryPoint,
  platformAllocationDelta,
  summarizeMemory,
  toMB,
  type MemoryPoint,
} from './metrics/memory';
import { setterSpans, summarizeProbes } from './metrics/probes';
import { roundTo } from './metrics/stats';
import { TransferTracker } from './metrics/transfer';
import {
  RESULT_SCHEMA_VERSION,
  type BridgeSummary,
  type BuildInfo,
  type CommitSummary,
  type ScenarioResult,
  type StepResult,
  type TimelineWindow,
} from './result';

export interface MountResult {
  commitMs: number;
  readyMs: number;
  timedOut: boolean;
}

/** The mounted map the runner drives; implemented by `MapHost`. */
export interface MapHostApi {
  mount(props: PerfMapProps, provider: string): Promise<MountResult>;
  setProps(patch: Partial<PerfMapProps>): Promise<CommitSample>;
  unmount(): Promise<void>;
  map(): MapViewRef | null;
  takeEventCounts(): Record<string, number>;
}

export interface RunnerEnvironment {
  runId: string;
  label?: string;
  platform: 'ios' | 'android';
  provider: string;
  device: DeviceInfo;
  build: BuildInfo;
  onStatus?(message: string): void;
  /** Writes one `[perf-lab] {...}` line to the system log. */
  emit(event: Record<string, unknown>): Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ClockOffset {
  /** Native ns minus JS `performance.now()` in ns. */
  offsetNs: number;
  roundTripMs: number;
}

/** Aligns `performance.now()` with the native monotonic clock the probes use. */
function alignClock(): ClockOffset {
  let best: ClockOffset | null = null;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    const before = performance.now();
    const native = nowNs();
    const after = performance.now();
    const candidate = {
      offsetNs: native - ((before + after) / 2) * 1e6,
      roundTripMs: after - before,
    };
    if (best == null || candidate.roundTripMs < best.roundTripMs) {
      best = candidate;
    }
  }
  return best as ClockOffset;
}

function summarizeCommits(commits: CommitSample[]): CommitSummary {
  const values = commits.map((commit) => commit.commitMs).sort((a, b) => a - b);
  let total = 0;
  for (const value of values) {
    total += value;
  }
  const rank = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(0.95 * values.length) - 1),
  );
  return {
    count: values.length,
    totalMs: roundTo(total, 2),
    avgMs: roundTo(values.length > 0 ? total / values.length : 0, 3),
    p95Ms: roundTo(values.length > 0 ? values[rank] : 0, 3),
    maxMs: roundTo(values.length > 0 ? values[values.length - 1] : 0, 3),
  };
}

/**
 * Pairs each JS commit with the first native `*.set` span that started after
 * it, giving the commit → UI-thread setter latency and the setter duration.
 */
function summarizeBridge(
  commits: CommitSample[],
  spans: ProbeSpan[],
  clock: ClockOffset,
): BridgeSummary {
  const setters = setterSpans({ spans, dropped: 0 });
  if (setters.length === 0 || commits.length === 0) {
    return { commitToNativeMs: null, setterMs: null };
  }
  const latencies: number[] = [];
  const durations: number[] = [];
  let cursor = 0;
  for (const commit of commits) {
    while (cursor < setters.length) {
      const startMs = (setters[cursor].startNs - clock.offsetNs) / 1e6;
      if (startMs >= commit.committedAt - 2) {
        break;
      }
      cursor += 1;
    }
    const span = setters[cursor];
    if (span == null) {
      break;
    }
    const startMs = (span.startNs - clock.offsetNs) / 1e6;
    if (startMs - commit.committedAt > 5000) {
      continue;
    }
    latencies.push(Math.max(0, startMs - commit.committedAt));
    durations.push(span.durationNs / 1e6);
    cursor += 1;
  }
  const stats = (values: number[]) =>
    values.length === 0
      ? null
      : {
          samples: values.length,
          avgMs: roundTo(
            values.reduce((sum, value) => sum + value, 0) / values.length,
            3,
          ),
          maxMs: roundTo(Math.max(...values), 3),
        };
  return { commitToNativeMs: stats(latencies), setterMs: stats(durations) };
}

function mergeRecordings(recordings: FrameRecording[]): FrameRecording {
  const first = recordings[0];
  return {
    intervalsMs: recordings.flatMap((recording) => recording.intervalsMs),
    expectedMs: recordings.flatMap((recording) => recording.expectedMs),
    durationMs: recordings.reduce(
      (sum, recording) => sum + recording.durationMs,
      0,
    ),
    refreshRateHz: first?.refreshRateHz ?? 60,
    startNs: first?.startNs ?? 0,
    android: first?.android
      ? {
          frames: recordings.reduce(
            (sum, recording) => sum + (recording.android?.frames ?? 0),
            0,
          ),
          totalMs: recordings.flatMap(
            (recording) => recording.android?.totalMs ?? [],
          ),
          phaseSumsMs: recordings.reduce(
            (sums, recording) => {
              const phases = recording.android?.phaseSumsMs;
              if (phases) {
                for (const key of Object.keys(sums) as (keyof typeof sums)[]) {
                  sums[key] += phases[key] ?? 0;
                }
              }
              return sums;
            },
            { ...first.android.phaseSumsMs },
          ),
          missedDeadline: recordings.reduce(
            (sum, recording) => sum + (recording.android?.missedDeadline ?? 0),
            0,
          ),
        }
      : undefined,
  };
}

/**
 * Mounts, settles, records and drives one scenario, then unmounts and
 * measures what was left behind.
 *
 * Phases: memory `before` → mount + `onMapReady` (load spans) → settle →
 * memory `afterLoad` → recorders on → `scenario.run` → recorders off →
 * memory `afterInteraction` → unmount → memory `afterCleanup`.
 */
export async function runScenario(
  scenario: Scenario,
  host: MapHostApi,
  env: RunnerEnvironment,
): Promise<ScenarioResult> {
  const status = (message: string) =>
    env.onStatus?.(`${scenario.id}: ${message}`);
  const errors: string[] = [];
  const notes: string[] = [];
  const metrics: Record<string, number> = {};
  const steps: StepResult[] = [];
  const timeline: TimelineWindow[] = [];
  const memoryPoints: MemoryPoint[] = [];
  const commits: CommitSample[] = [];
  const allSpans: ProbeSpan[] = [];
  let dropped = 0;
  const tracker = new TransferTracker();
  const probes = env.build.perfProbes;

  await host.unmount();
  clearFixtureCache();
  await sleep(400);
  status('measuring baseline memory');
  const clock = alignClock();
  if (probes) {
    await setProbesEnabled(true);
    await drainProbes();
  }
  const memoryBefore = await memorySnapshot();
  memoryPoints.push(memoryPoint('before', memoryBefore));
  const hermesBeforeLoad = readHermesStats();

  status('mounting');
  const props = scenario.props();
  tracker.recordPatch(props);
  const mountCommit: CommitSample[] = [];
  const mount = await host.mount(props, env.provider);
  mountCommit.push({
    label: 'mount',
    commitMs: mount.commitMs,
    committedAt: performance.now(),
  });
  if (mount.timedOut) {
    errors.push('onMapReady did not fire within 20 s');
  }
  await sleep(scenario.settleMs ?? 1500);
  const loadDrain = probes ? await drainProbes() : null;
  if (loadDrain) {
    dropped += loadDrain.dropped;
  }
  const hermesAfterLoad = readHermesStats();
  const memoryAfterLoad = await memorySnapshot();
  memoryPoints.push(memoryPoint('afterLoad', memoryAfterLoad));
  host.takeEventCounts();

  status('recording');
  const cpuBefore = await processStats();
  let hermesWindowStart: HermesStats = readHermesStats();
  const hermesInteractionStart = hermesWindowStart;
  let windowSpans: ProbeSpan[] = [];
  let windowCpu = cpuBefore;
  const recordings: FrameRecording[] = [];
  const interactionStarted = performance.now();
  const jsRecorder = startJsThreadRecorder(
    1000 / Math.max(30, env.device.refreshRateHz),
  );
  // Android: React Native dispatches JS timers and animation frames from the
  // UI thread's Choreographer and skips a vsync now and then even when idle,
  // so a native ping of the JS message queue is the reliable lag signal there.
  let jsQueueProbe = false;
  if (env.platform === 'android' && jsQueueProbeAvailable()) {
    jsQueueProbe = await startJsQueueProbe(8)
      .then(() => true)
      .catch(() => false);
  }
  await startFrameRecording();

  let currentStep: { label: string; commits: CommitSample[] } | null = null;

  const drainInto = async (): Promise<ProbeSpan[]> => {
    if (!probes) {
      return [];
    }
    const drain = await drainProbes();
    dropped += drain.dropped;
    allSpans.push(...drain.spans);
    windowSpans.push(...drain.spans);
    return drain.spans;
  };

  const context: ScenarioContext = {
    platform: env.platform,
    refreshRateHz: env.device.refreshRateHz,
    map: () => host.map(),
    async setProps(patch, label = 'setProps') {
      tracker.recordPatch(patch);
      const sample = await host.setProps(patch);
      const labelled = { ...sample, label };
      commits.push(labelled);
      currentStep?.commits.push(labelled);
      return labelled;
    },
    sleep,
    async animateCamera(camera: Camera, durationMs: number, settleMs = 120) {
      await host.map()?.animateCamera(camera, durationMs / 1000);
      await sleep(durationMs + settleMs);
    },
    async setCamera(camera: Camera) {
      await host.map()?.setCamera(camera);
      await sleep(60);
    },
    async step(label: string, run: () => Promise<void>, meta: StepMeta = {}) {
      await drainInto();
      const hermesBefore = readHermesStats();
      const started = performance.now();
      const step = { label, commits: [] as CommitSample[] };
      currentStep = step;
      try {
        await run();
      } finally {
        const wallMs = performance.now() - started;
        const spans = await drainInto();
        currentStep = null;
        steps.push({
          index: steps.length,
          label,
          meta,
          wallMs: roundTo(wallMs, 2),
          commits: summarizeCommits(step.commits),
          bridge: summarizeBridge(step.commits, spans, clock),
          native: summarizeProbes({ spans, dropped: 0 }, probes),
          hermes: hermesDelta(hermesBefore, readHermesStats()),
        });
      }
    },
    async checkpoint(label: string) {
      const recording = await stopFrameRecording();
      recordings.push(recording);
      await drainInto();
      const snapshot = await memorySnapshot();
      const cpu = await processStats();
      const hermesNow = readHermesStats();
      const wallMs = cpu.wallTimeMs - windowCpu.wallTimeMs;
      timeline.push({
        index: timeline.length,
        label,
        atMs: roundTo(performance.now() - interactionStarted, 0),
        frames: computeFrameSummary(recording),
        memory: memoryPoint(label, snapshot),
        cpuPercent:
          wallMs > 0
            ? roundTo(((cpu.cpuTimeMs - windowCpu.cpuTimeMs) / wallMs) * 100, 1)
            : null,
        hermes: hermesDelta(hermesWindowStart, hermesNow),
        native: summarizeProbes({ spans: windowSpans, dropped: 0 }, probes),
      });
      memoryPoints.push(memoryPoint(`checkpoint:${label}`, snapshot));
      windowSpans = [];
      windowCpu = cpu;
      hermesWindowStart = hermesNow;
      status(`checkpoint ${label}`);
      await startFrameRecording();
    },
    async gestureWindow(name: string, durationMs: number) {
      await env.emit({
        event: 'gesture-window',
        runId: env.runId,
        scenario: scenario.id,
        name,
        durationMs,
      });
      await sleep(durationMs);
    },
    metric(name: string, value: number) {
      metrics[name] = value;
    },
    note(text: string) {
      notes.push(text);
    },
  };

  try {
    await scenario.run(context);
  } catch (error) {
    errors.push(`run failed: ${String(error)}`);
  }

  recordings.push(await stopFrameRecording());
  let js = jsRecorder.stop();
  if (jsQueueProbe) {
    js = withJsQueueProbe(js, await stopJsQueueProbe());
  }
  await drainInto();
  const cpuAfter = await processStats();
  const hermesAfter = readHermesStats();
  const memoryAfterInteraction = await memorySnapshot();
  memoryPoints.push(memoryPoint('afterInteraction', memoryAfterInteraction));
  const events = host.takeEventCounts();
  for (const [name, count] of Object.entries(events)) {
    for (let index = 0; index < count; index += 1) {
      tracker.recordEvent(name);
    }
  }
  if (probes) {
    await setProbesEnabled(false);
  }

  status('cleaning up');
  await host.unmount();
  clearFixtureCache();
  await sleep(800);
  const memoryAfterCleanup = await memorySnapshot();
  memoryPoints.push(memoryPoint('afterCleanup', memoryAfterCleanup));

  const frames = computeFrameSummary(mergeRecordings(recordings));
  const wallMs = cpuAfter.wallTimeMs - cpuBefore.wallTimeMs;
  const hermesInteraction = hermesDelta(hermesInteractionStart, hermesAfter);
  const allocation = platformAllocationDelta(
    env.platform,
    memoryAfterLoad,
    memoryAfterInteraction,
  );
  const loadSpans = loadDrain?.spans ?? [];

  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    runId: env.runId,
    label: env.label,
    scenario: scenario.id,
    name: scenario.name,
    group: scenario.group,
    tags: scenario.tags,
    description: scenario.description,
    recordedAt: new Date().toISOString(),
    platform: env.platform,
    provider: env.provider,
    os: `${env.platform} ${env.device.osVersion}`,
    device: env.device,
    build: env.build,
    refreshRateHz: frames.refreshRateHz,
    frameBudgetMs: frames.budgetMs,
    durationMs: roundTo(performance.now() - interactionStarted, 0),
    load: {
      commitMs: roundTo(mount.commitMs, 2),
      readyMs: roundTo(mount.readyMs, 0),
      timedOut: mount.timedOut,
      native: summarizeProbes(loadDrain, probes),
      bridge: summarizeBridge(mountCommit, loadSpans, clock),
      hermes: hermesDelta(hermesBeforeLoad, hermesAfterLoad),
    },
    frames,
    js: { ...js, commits: summarizeCommits(commits) },
    bridge: summarizeBridge(commits, allSpans, clock),
    native: summarizeProbes({ spans: allSpans, dropped }, probes),
    memory: summarizeMemory(memoryPoints),
    allocations: {
      hermes: {
        available: hermesInteraction.available,
        allocatedBytes: hermesInteraction.allocatedBytes,
        gcCount: hermesInteraction.gcCount,
        gcTimeMs: hermesInteraction.gcTimeMs,
        heapSizeAfterMB: toMB(hermesInteraction.heapSizeAfterBytes),
      },
      ...allocation,
    },
    cpu: {
      processCpuMs: roundTo(cpuAfter.cpuTimeMs - cpuBefore.cpuTimeMs, 0),
      wallMs: roundTo(wallMs, 0),
      percent: roundTo(
        wallMs > 0
          ? ((cpuAfter.cpuTimeMs - cpuBefore.cpuTimeMs) / wallMs) * 100
          : 0,
        1,
      ),
      threadsBefore: cpuBefore.threadCount,
      threadsAfter: cpuAfter.threadCount,
      thermalBefore: cpuBefore.thermalState,
      thermalAfter: cpuAfter.thermalState,
      batteryLevel: cpuAfter.batteryLevel,
      batteryState: cpuAfter.batteryState,
      lowPowerMode: cpuAfter.lowPowerMode,
    },
    transfer: tracker.summary(),
    steps,
    timeline,
    metrics,
    notes: [
      ...notes,
      `clock alignment round trip ${clock.roundTripMs.toFixed(3)} ms`,
      ...(probes
        ? []
        : ['native probes not compiled in: native/bridge sections are N/A']),
    ],
    errors,
  };
}

export function describeMemory(snapshot: MemorySnapshot): string {
  return `${toMB(snapshot.footprintBytes) ?? '?'} MB`;
}
