import type { DeviceInfo } from '../../example/modules/perf-lab';
import type { StepMeta } from '../scenarios/types';
import type { FrameSummary } from './metrics/frameStats';
import type { HermesDelta } from './metrics/hermes';
import type { JsThreadSummary } from './metrics/jsThread';
import type {
  AllocationSummary,
  MemoryPoint,
  MemorySummary,
} from './metrics/memory';
import type { ProbeSummary } from './metrics/probes';
import type { TransferSummary } from './metrics/transfer';

export const RESULT_SCHEMA_VERSION = 1;

export interface BuildInfo {
  /** `release` when the native binary is not debuggable. */
  type: 'debug' | 'release';
  /** `__DEV__`: the JS bundle is a development bundle (Metro, dev checks). */
  jsDev: boolean;
  hermes: boolean;
  /** Library compiled with PerfProbe recording (a "profile" build). */
  perfProbes: boolean;
  /**
   * True only for release native + production JS on a physical device.
   * Everything else must not be presented as production performance.
   */
  representative: boolean;
  caveats: string[];
}

export interface CommitSummary {
  count: number;
  totalMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface BridgeSummary {
  /**
   * From the end of the React commit (JS thread) to the start of the native
   * prop setter (UI thread): Fabric mount scheduling plus the C++ → Swift /
   * JNI copy of the descriptor arrays. Requires native probes.
   */
  commitToNativeMs: { samples: number; avgMs: number; maxMs: number } | null;
  /** Duration of the native `*.set` spans that followed the commits. */
  setterMs: { samples: number; avgMs: number; maxMs: number } | null;
}

export interface StepResult {
  index: number;
  label: string;
  meta: StepMeta;
  wallMs: number;
  commits: CommitSummary;
  bridge: BridgeSummary;
  native: ProbeSummary;
  hermes: HermesDelta;
}

export interface TimelineWindow {
  index: number;
  label: string;
  /** Milliseconds since the interaction started. */
  atMs: number;
  frames: FrameSummary;
  memory: MemoryPoint;
  cpuPercent: number | null;
  hermes: HermesDelta;
  native: ProbeSummary;
}

export interface LoadSummary {
  /** JS-thread time of the mounting commit (React + shadow tree + Nitro prop parsing). */
  commitMs: number;
  /** From the mount call to `onMapReady`. */
  readyMs: number;
  timedOut: boolean;
  native: ProbeSummary;
  bridge: BridgeSummary;
  hermes: HermesDelta;
}

export interface CpuSummary {
  processCpuMs: number;
  wallMs: number;
  /** Process CPU time over wall time; can exceed 100 on multi-core devices. */
  percent: number;
  threadsBefore: number;
  threadsAfter: number;
  thermalBefore: string;
  thermalAfter: string;
  batteryLevel: number;
  batteryState: string;
  lowPowerMode: boolean;
}

export interface ScenarioResult {
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  runId: string;
  label?: string;
  scenario: string;
  name: string;
  group: string;
  tags: string[];
  description: string;
  recordedAt: string;
  platform: 'ios' | 'android';
  provider: string;
  os: string;
  device: DeviceInfo;
  build: BuildInfo;
  refreshRateHz: number;
  frameBudgetMs: number;
  durationMs: number;
  load: LoadSummary;
  frames: FrameSummary;
  js: JsThreadSummary & { commits: CommitSummary };
  bridge: BridgeSummary;
  native: ProbeSummary;
  memory: MemorySummary;
  allocations: AllocationSummary;
  cpu: CpuSummary;
  transfer: TransferSummary;
  steps: StepResult[];
  timeline: TimelineWindow[];
  metrics: Record<string, number>;
  notes: string[];
  errors: string[];
}

export interface RunFile {
  schemaVersion: typeof RESULT_SCHEMA_VERSION;
  runId: string;
  label?: string;
  suite?: string;
  startedAt: string;
  finishedAt: string;
  platform: 'ios' | 'android';
  provider: string;
  device: DeviceInfo;
  build: BuildInfo;
  scenarios: string[];
  results: ScenarioResult[];
  failures: { scenario: string; error: string }[];
}

/** One compact line per scenario for the system log (kept under 1 KB). */
export function summaryLine(result: ScenarioResult): Record<string, unknown> {
  return {
    scenario: result.scenario,
    fps: result.frames.fps.average,
    fpsP95: result.frames.fps.p95,
    p50: result.frames.frameTimeMs.p50,
    p95: result.frames.frameTimeMs.p95,
    p99: result.frames.frameTimeMs.p99,
    worst: result.frames.frameTimeMs.worst,
    jank: result.frames.jankRatio,
    jsLagP95: result.js.lagMs.p95,
    jsCommitAvg: result.js.commits.avgMs,
    nativeMainMs: result.native.mainThreadMs,
    loadReadyMs: result.load.readyMs,
    memAfterMB: result.memory.afterInteractionMB,
    memDeltaMB: result.memory.interactionDeltaMB,
    cpuPct: result.cpu.percent,
    errors: result.errors.length,
  };
}
