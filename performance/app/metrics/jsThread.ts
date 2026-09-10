import { distribution, roundTo } from './stats';

export interface LongTask {
  startTime: number;
  duration: number;
}

export type LagSource = 'animation-frame' | 'js-queue-ping';

export interface JsThreadSummary {
  /**
   * `animation-frame`: how late each JS animation frame arrived (gap between
   * `requestAnimationFrame` callbacks minus the frame interval). Zero while
   * the JS thread keeps up; work shorter than a frame is invisible.
   * `js-queue-ping` (Android): how long a native ping waited in the JS
   * message queue; sees every JS task longer than the ping interval.
   */
  lagSource: LagSource;
  lagMs: {
    samples: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  /** Raw gap between JS frames; p50 equals the frame interval when JS keeps up. */
  frameGapMs: { p50: number; p95: number; max: number };
  /** JS frames that arrived more than half a frame late. */
  lateFrames: number;
  /** Sum of lateness: JS-thread time that overran frame boundaries. */
  busyMs: number;
  busyRatio: number;
  /** From `PerformanceObserver` `longtask` entries when the runtime reports them, else from lag samples > 50 ms. */
  longTasks: {
    count: number;
    totalMs: number;
    maxMs: number;
    source: 'performance-observer' | 'lag-sampler';
  };
  durationMs: number;
}

export interface JsThreadRecorder {
  stop(): JsThreadSummary;
}

interface PerformanceObserverLike {
  observe(options: { entryTypes: string[] }): void;
  disconnect(): void;
}

interface PerformanceObserverConstructorLike {
  new (
    callback: (list: { getEntries(): LongTask[] }) => void,
  ): PerformanceObserverLike;
  supportedEntryTypes?: readonly string[];
}

function longTaskObserver(sink: LongTask[]): PerformanceObserverLike | null {
  const ctor = (
    globalThis as unknown as {
      PerformanceObserver?: PerformanceObserverConstructorLike;
    }
  ).PerformanceObserver;
  if (ctor == null || !ctor.supportedEntryTypes?.includes('longtask')) {
    return null;
  }
  try {
    const observer = new ctor((list) => {
      for (const entry of list.getEntries()) {
        sink.push({ startTime: entry.startTime, duration: entry.duration });
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
    return observer;
  } catch {
    return null;
  }
}

/**
 * Samples JS-thread availability with `requestAnimationFrame`: React Native
 * drives it from the display's vsync on both platforms, so while the JS
 * thread keeps up the gap between callbacks is one frame interval. A React
 * commit serializing a marker array, or any other JS work that overruns a
 * frame, shows as a late callback. (`setTimeout` is not usable for this on
 * Android, where timers only fire on frame boundaries and read ~18 ms late
 * even when idle.)
 */
export function startJsThreadRecorder(
  expectedFrameMs: number,
): JsThreadRecorder {
  const samples: number[] = [];
  const gaps: number[] = [];
  const longTasks: LongTask[] = [];
  const observer = longTaskObserver(longTasks);
  const startedAt = performance.now();
  let last = startedAt;
  let running = true;
  let handle = 0;

  const tick = () => {
    if (!running) {
      return;
    }
    const now = performance.now();
    const gap = now - last;
    gaps.push(gap);
    samples.push(Math.max(0, gap - expectedFrameMs));
    last = now;
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(handle);
      observer?.disconnect();
      const durationMs = performance.now() - startedAt;
      const lag = distribution(samples);
      const gapStats = distribution(gaps);
      let busyMs = 0;
      let lateFrames = 0;
      for (const sample of samples) {
        busyMs += sample;
        if (sample > expectedFrameMs / 2) {
          lateFrames += 1;
        }
      }
      const fromObserver = observer != null;
      const tasks = fromObserver
        ? longTasks
        : samples
            .filter((sample) => sample > 50)
            .map((duration) => ({ startTime: 0, duration }));
      let totalMs = 0;
      let maxMs = 0;
      for (const task of tasks) {
        totalMs += task.duration;
        maxMs = Math.max(maxMs, task.duration);
      }
      return {
        lagSource: 'animation-frame',
        lagMs: {
          samples: lag.samples,
          p50: roundTo(lag.p50, 2),
          p95: roundTo(lag.p95, 2),
          p99: roundTo(lag.p99, 2),
          max: roundTo(lag.max, 2),
        },
        frameGapMs: {
          p50: roundTo(gapStats.p50, 2),
          p95: roundTo(gapStats.p95, 2),
          max: roundTo(gapStats.max, 2),
        },
        lateFrames,
        busyMs: roundTo(busyMs, 1),
        busyRatio: roundTo(durationMs > 0 ? busyMs / durationMs : 0, 4),
        longTasks: {
          count: tasks.length,
          totalMs: roundTo(totalMs, 1),
          maxMs: roundTo(maxMs, 1),
          source: fromObserver ? 'performance-observer' : 'lag-sampler',
        },
        durationMs: roundTo(durationMs, 1),
      };
    },
  };
}

/**
 * Replaces the animation-frame lag with a native JS-queue ping recording
 * (Android): the delay before each ping ran is JS-thread busy time, sampled
 * without going through the UI thread's Choreographer.
 */
export function withJsQueueProbe(
  summary: JsThreadSummary,
  recording: { latenessMs: number[]; durationMs: number },
): JsThreadSummary {
  if (recording.latenessMs.length === 0) {
    return summary;
  }
  const lag = distribution(recording.latenessMs);
  let busyMs = 0;
  let longCount = 0;
  let longTotal = 0;
  let longMax = 0;
  for (const sample of recording.latenessMs) {
    busyMs += sample;
    if (sample > 50) {
      longCount += 1;
      longTotal += sample;
      longMax = Math.max(longMax, sample);
    }
  }
  const usePingLongTasks = summary.longTasks.source === 'lag-sampler';
  return {
    ...summary,
    lagSource: 'js-queue-ping',
    lagMs: {
      samples: lag.samples,
      p50: roundTo(lag.p50, 2),
      p95: roundTo(lag.p95, 2),
      p99: roundTo(lag.p99, 2),
      max: roundTo(lag.max, 2),
    },
    busyMs: roundTo(busyMs, 1),
    busyRatio: roundTo(
      recording.durationMs > 0 ? busyMs / recording.durationMs : 0,
      4,
    ),
    longTasks: usePingLongTasks
      ? {
          count: longCount,
          totalMs: roundTo(longTotal, 1),
          maxMs: roundTo(longMax, 1),
          source: 'lag-sampler',
        }
      : summary.longTasks,
  };
}
