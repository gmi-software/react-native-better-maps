import { requireNativeModule } from 'expo';

/**
 * Raw output of one recording session.
 *
 * `intervalsMs[i]` is the time between display refresh callbacks i and i+1 on
 * the main thread; `expectedMs[i]` is the refresh interval the display was
 * running at for that frame. Both are needed: ProMotion and adaptive Android
 * displays change rate on their own, so jank is "longer than the interval the
 * display asked for", not "longer than 16.67 ms".
 */
export interface FrameRecording {
  intervalsMs: number[];
  expectedMs: number[];
  durationMs: number;
  refreshRateHz: number;
}

interface NativeFrameStats {
  start(): Promise<void>;
  stop(): Promise<FrameRecording>;
  memoryFootprint(): Promise<number>;
  displayRefreshRate(): Promise<number>;
  logLine(line: string): Promise<void>;
}

const native = requireNativeModule<NativeFrameStats>('FrameStats');

/** Starts recording main-thread frame intervals. Stops any recording in progress. */
export function startFrameRecording(): Promise<void> {
  return native.start();
}

/** Stops recording and returns every frame interval seen since `start`. */
export function stopFrameRecording(): Promise<FrameRecording> {
  return native.stop();
}

/** Resident memory of the process in bytes (`phys_footprint` on iOS, PSS on Android). */
export function memoryFootprintBytes(): Promise<number> {
  return native.memoryFootprint();
}

/** Maximum refresh rate of the main display, in Hz. */
export function displayRefreshRateHz(): Promise<number> {
  return native.displayRefreshRate();
}

/**
 * Writes a line to the system log (`NSLog` on iOS, `Log.i` tag
 * `NitroMapsBenchmark` on Android), which release builds keep while
 * `console.log` output is dropped.
 */
export function logBenchmarkLine(line: string): Promise<void> {
  return native.logLine(line);
}
