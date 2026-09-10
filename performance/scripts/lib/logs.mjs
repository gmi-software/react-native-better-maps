import { adbPath } from './devices.mjs';
import { spawnProcess, tryRun } from './util.mjs';

const MARKER = '[perf-lab] ';

/**
 * Streams `[perf-lab] {...}` events from the device log. Android: logcat with
 * the `NitroMapsPerfLab` tag. iOS simulator: `log stream` filtered on the
 * lab's os_log subsystem. Returns a handle with `stop()`.
 */
export function startLogTail(target, onEvent, onRaw) {
  let child;
  if (target.platform === 'android') {
    tryRun(adbPath(), ['-s', target.id, 'logcat', '-c']);
    child = spawnProcess(adbPath(), ['-s', target.id, 'logcat', '-v', 'raw', '-s', 'NitroMapsPerfLab']);
  } else {
    child = spawnProcess('xcrun', [
      'simctl',
      'spawn',
      target.id,
      'log',
      'stream',
      '--style',
      'compact',
      '--predicate',
      'subsystem == "com.nitromaps.perflab"',
    ]);
  }
  let buffer = '';
  const handleChunk = (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      onRaw?.(line);
      const start = line.indexOf(MARKER);
      if (start < 0) {
        continue;
      }
      try {
        onEvent(JSON.parse(line.slice(start + MARKER.length)));
      } catch {
        // truncated or interleaved line
      }
    }
  };
  child.stdout.on('data', handleChunk);
  child.stderr.on('data', (chunk) => onRaw?.(`[stderr] ${chunk.toString('utf8').trim()}`));
  return {
    stop() {
      child.kill('SIGTERM');
    },
  };
}

/** Reassembles a run file streamed as base64 `result-chunk` events. */
export function assembleChunks(chunks) {
  if (chunks.size === 0) {
    return null;
  }
  const total = [...chunks.values()][0].total;
  if (chunks.size !== total) {
    return null;
  }
  let json = '';
  for (let index = 0; index < total; index += 1) {
    const chunk = chunks.get(index);
    if (chunk == null) {
      return null;
    }
    json += Buffer.from(chunk.data, 'base64').toString('utf8');
  }
  return JSON.parse(json);
}
