import { requireNativeModule } from 'expo';

/**
 * Raw output of one frame recording.
 *
 * `intervalsMs[i]` is the time between display refresh callbacks i and i+1 on
 * the main thread; `expectedMs[i]` is the refresh interval the display was
 * running at for that frame (ProMotion and adaptive Android displays change
 * rate on their own, so jank is judged per frame, not against a fixed 16.67 ms).
 */
export interface FrameRecording {
  intervalsMs: number[];
  expectedMs: number[];
  durationMs: number;
  refreshRateHz: number;
  /** Clock value (see `nowNs`) when recording started. */
  startNs: number;
  /** Android only: `FrameMetrics` from the window, per rendered frame. */
  android?: AndroidFrameMetrics;
}

export interface AndroidFrameMetrics {
  frames: number;
  /** Per-frame `TOTAL_DURATION` in ms (CPU work on the UI + render threads). */
  totalMs: number[];
  /** Sum of each phase across all frames, in ms. */
  phaseSumsMs: {
    unknownDelay: number;
    inputHandling: number;
    animation: number;
    layoutMeasure: number;
    draw: number;
    sync: number;
    commandIssue: number;
    swapBuffers: number;
    gpu: number;
    total: number;
  };
  missedDeadline: number;
}

export interface MemorySnapshot {
  /** phys_footprint on iOS, PSS on Android; the number the OS uses for memory pressure. */
  footprintBytes: number;
  residentBytes: number;
  /** iOS: malloc blocks in use (all zones). */
  mallocBlocksInUse?: number;
  mallocBytesInUse?: number;
  /** Android: Java heap in use (Runtime.totalMemory - freeMemory). */
  javaHeapUsedBytes?: number;
  /** Android: Debug.getNativeHeapAllocatedSize(). */
  nativeHeapAllocatedBytes?: number;
  nativeHeapSizeBytes?: number;
  /** Android ART runtime GC stats (cumulative since process start). */
  gcCount?: number;
  gcTimeMs?: number;
  bytesAllocated?: number;
  bytesFreed?: number;
  blockingGcCount?: number;
  blockingGcTimeMs?: number;
  /** Android: Debug.MemoryInfo summary (kB) keyed as reported by the platform. */
  memoryStats?: Record<string, number>;
}

export interface ProcessStats {
  /** Process CPU time (user + system) in ms since process start. */
  cpuTimeMs: number;
  /** Monotonic wall clock in ms (same clock as `nowNs`). */
  wallTimeMs: number;
  threadCount: number;
  thermalState: string;
  batteryLevel: number;
  batteryState: string;
  lowPowerMode: boolean;
}

export interface DeviceInfo {
  platform: 'ios' | 'android';
  model: string;
  manufacturer: string;
  deviceName?: string;
  osVersion: string;
  apiLevel?: number;
  refreshRateHz: number;
  supportedRefreshRatesHz?: number[];
  screenScale: number;
  screenWidthPx: number;
  screenHeightPx: number;
  isDebugBuild: boolean;
  isSimulator: boolean;
  cpuCores: number;
  totalMemoryBytes: number;
  appVersion: string;
}

/** Android only: delay of runnables posted to React Native's JS message queue. */
export interface JsQueueRecording {
  latenessMs: number[];
  samples: number;
  intervalMs: number;
  durationMs: number;
}

export interface ProbeSpan {
  name: string;
  startNs: number;
  durationNs: number;
  count: number;
  thread: 'main' | 'background';
}

export interface ProbeDrain {
  spans: ProbeSpan[];
  dropped: number;
}

interface NativePerfLab {
  startFrames(): Promise<void>;
  stopFrames(): Promise<FrameRecording>;
  memorySnapshot(): Promise<MemorySnapshot>;
  processStats(): Promise<ProcessStats>;
  deviceInfo(): Promise<DeviceInfo>;
  nowNs(): number;
  launchRequest?(): string | null;
  startJsQueueProbe?(intervalMs: number): Promise<void>;
  stopJsQueueProbe?(): Promise<JsQueueRecording>;
  probesAvailable(): boolean;
  setProbesEnabled(enabled: boolean): Promise<void>;
  drainProbes(): Promise<string>;
  logLine(line: string): Promise<void>;
  writeResultFile(name: string, content: string): Promise<string>;
}

const native = requireNativeModule<NativePerfLab>('PerfLab');

/** Starts recording main-thread frame intervals. Stops any recording in progress. */
export function startFrameRecording(): Promise<void> {
  return native.startFrames();
}

/** Stops recording and returns every frame interval seen since `start`. */
export function stopFrameRecording(): Promise<FrameRecording> {
  return native.stopFrames();
}

export function memorySnapshot(): Promise<MemorySnapshot> {
  return native.memorySnapshot();
}

export function processStats(): Promise<ProcessStats> {
  return native.processStats();
}

export async function deviceInfo(): Promise<DeviceInfo> {
  const info = await native.deviceInfo();
  return {
    ...info,
    refreshRateHz: Math.round(info.refreshRateHz * 100) / 100,
    supportedRefreshRatesHz: info.supportedRefreshRatesHz?.map(
      (rate) => Math.round(rate * 100) / 100,
    ),
  };
}

/**
 * Native monotonic clock in nanoseconds, on the clock the library probes and
 * the frame recorder use. Synchronous, so it can be paired with
 * `performance.now()` to align JS and native timestamps.
 */
export function nowNs(): number {
  return native.nowNs();
}

/**
 * A run request handed over at process launch (iOS: `--perf-run=<url>` launch
 * argument or `PERF_LAB_RUN` env; Android: `perfRun` intent extra), or null.
 */
export function launchRequest(): string | null {
  return typeof native.launchRequest === 'function'
    ? (native.launchRequest() ?? null)
    : null;
}

/** Whether the native module can ping the JS message queue (Android). */
export function jsQueueProbeAvailable(): boolean {
  return (
    typeof native.startJsQueueProbe === 'function' &&
    typeof native.stopJsQueueProbe === 'function'
  );
}

/**
 * Starts pinging React Native's JS message queue from a native thread every
 * `intervalMs`; the delay before each ping runs is JS-thread busy time.
 */
export function startJsQueueProbe(intervalMs: number): Promise<void> {
  if (typeof native.startJsQueueProbe !== 'function') {
    return Promise.reject(
      new Error('JS queue probe is not available on this platform'),
    );
  }
  return native.startJsQueueProbe(intervalMs);
}

export function stopJsQueueProbe(): Promise<JsQueueRecording> {
  if (typeof native.stopJsQueueProbe !== 'function') {
    return Promise.resolve({
      latenessMs: [],
      samples: 0,
      intervalMs: 0,
      durationMs: 0,
    });
  }
  return native.stopJsQueueProbe();
}

/** Whether the library was built with `PerfProbe` recording compiled in. */
export function probesAvailable(): boolean {
  return native.probesAvailable();
}

export function setProbesEnabled(enabled: boolean): Promise<void> {
  return native.setProbesEnabled(enabled);
}

/** Drains and parses every native span recorded since the previous drain. */
export async function drainProbes(): Promise<ProbeDrain> {
  const json = await native.drainProbes();
  try {
    return JSON.parse(json) as ProbeDrain;
  } catch {
    return { spans: [], dropped: 0 };
  }
}

/**
 * Writes a line to the system log (`os_log` on iOS, logcat tag
 * `NitroMapsPerfLab` on Android). Release builds keep these while
 * `console.log` output is dropped, which is how the CLI harvests progress.
 */
export function logLine(line: string): Promise<void> {
  return native.logLine(line);
}

/**
 * Writes a result file the CLI can pull: `Documents/perf-lab/<name>` on iOS,
 * the app's external files dir (`Android/data/<package>/files/perf-lab/<name>`)
 * on Android. Resolves to the absolute path.
 */
export function writeResultFile(
  name: string,
  content: string,
): Promise<string> {
  return native.writeResultFile(name, content);
}
