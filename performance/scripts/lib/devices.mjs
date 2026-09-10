import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, tryRun } from './util.mjs';

export function adbPath() {
  const home = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(os.homedir(), 'Library/Android/sdk');
  const candidate = path.join(home, 'platform-tools', 'adb');
  return existsSync(candidate) ? candidate : 'adb';
}

export function listAndroidDevices() {
  const output = tryRun(adbPath(), ['devices', '-l']);
  if (output == null) {
    return [];
  }
  return output
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /\sdevice\s/.test(`${line} `))
    .map((line) => {
      const [serial, ...rest] = line.split(/\s+/);
      const model = rest.find((part) => part.startsWith('model:'))?.slice(6) ?? serial;
      return { platform: 'android', id: serial, name: model, simulator: serial.startsWith('emulator-') };
    });
}

export function listIosSimulators() {
  const output = tryRun('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
  if (output == null) {
    return [];
  }
  const parsed = JSON.parse(output);
  const devices = [];
  for (const [runtime, list] of Object.entries(parsed.devices ?? {})) {
    for (const device of list) {
      if (device.state === 'Booted') {
        devices.push({
          platform: 'ios',
          id: device.udid,
          name: device.name,
          runtime: runtime.split('.').pop(),
          simulator: true,
        });
      }
    }
  }
  return devices;
}

export function listDevices() {
  return [...listAndroidDevices(), ...listIosSimulators()];
}

export function resolveTarget({ platform, device }) {
  const devices = listDevices().filter((entry) => platform == null || entry.platform === platform);
  if (devices.length === 0) {
    throw new Error(
      platform === 'ios'
        ? 'No booted iOS simulator. Boot one (xcrun simctl boot "iPhone 17 Pro") or run on a device by hand.'
        : 'No connected Android device or emulator (adb devices).',
    );
  }
  if (device != null) {
    const match = devices.find((entry) => entry.id === device || entry.name === device);
    if (match == null) {
      throw new Error(`Device "${device}" not found. Known: ${devices.map((entry) => `${entry.id} (${entry.name})`).join(', ')}`);
    }
    return match;
  }
  if (devices.length > 1 && platform == null) {
    throw new Error(`Several targets available, pass --platform or --device: ${devices.map((entry) => `${entry.platform}:${entry.id} (${entry.name})`).join(', ')}`);
  }
  return devices[0];
}

export function screenSize(target) {
  if (target.platform !== 'android') {
    return null;
  }
  const output = tryRun(adbPath(), ['-s', target.id, 'shell', 'wm', 'size']) ?? '';
  const match = /(\d+)x(\d+)/.exec(output);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

export function isAppInstalled(target, appId) {
  if (target.platform === 'android') {
    return (tryRun(adbPath(), ['-s', target.id, 'shell', 'pm', 'path', appId]) ?? '').includes('package:');
  }
  return tryRun('xcrun', ['simctl', 'get_app_container', target.id, appId, 'data']) != null;
}

export function openUrl(target, appId, url) {
  if (target.platform === 'android') {
    // adb joins the arguments into one command line for the device shell, so
    // the URL must be quoted there or `&` starts a background job.
    run(adbPath(), ['-s', target.id, 'shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', `'${url}'`, appId]);
    return;
  }
  run('xcrun', ['simctl', 'openurl', target.id, url]);
}

export function launchApp(target, appId, args = []) {
  if (target.platform === 'android') {
    run(adbPath(), ['-s', target.id, 'shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1']);
    return;
  }
  run('xcrun', ['simctl', 'launch', target.id, appId, ...args]);
}

/**
 * Wakes the device and keeps the screen on for the run. A sleeping Android
 * device pauses the activity, and React Native pauses JS timers with it, so
 * the runner would stall silently.
 */
export function prepareTarget(target) {
  if (target.platform !== 'android') {
    return;
  }
  tryRun(adbPath(), ['-s', target.id, 'shell', 'settings', 'put', 'global', 'stay_on_while_plugged_in', '7']);
  tryRun(adbPath(), ['-s', target.id, 'shell', 'svc', 'power', 'stayon', 'true']);
  tryRun(adbPath(), ['-s', target.id, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  tryRun(adbPath(), ['-s', target.id, 'shell', 'wm', 'dismiss-keyguard']);
  const window = tryRun(adbPath(), ['-s', target.id, 'shell', 'dumpsys', 'window']) ?? '';
  if (/isKeyguardShowing=true/.test(window)) {
    throw new Error(
      `${target.name} is locked with a secure lock screen; unlock it (and keep it unlocked) before running. A locked device pauses the app, so the run would stall.`,
    );
  }
  const connectivity = tryRun(adbPath(), ['-s', target.id, 'shell', 'dumpsys', 'connectivity']) ?? '';
  if (/Active default network: none/.test(connectivity)) {
    process.stderr.write(`warning: ${target.name} has no network; map tiles will not load and onMapReady may time out.\n`);
  }
}

/** Starts a run: Android through a VIEW intent, iOS through a launch argument (no "Open in" prompt). */
export function startRun(target, appId, url) {
  if (target.platform === 'android') {
    openUrl(target, appId, url);
    return;
  }
  launchApp(target, appId, [`--perf-run=${url}`]);
}

export function terminateApp(target, appId) {
  if (target.platform === 'android') {
    tryRun(adbPath(), ['-s', target.id, 'shell', 'am', 'force-stop', appId]);
    return;
  }
  tryRun('xcrun', ['simctl', 'terminate', target.id, appId]);
}

/** Copies the app-written result file to `destination`; returns false when unreachable. */
export function pullResultFile(target, appId, runId, destination) {
  if (target.platform === 'android') {
    const remote = `/sdcard/Android/data/${appId}/files/perf-lab/${runId}.json`;
    return tryRun(adbPath(), ['-s', target.id, 'pull', remote, destination]) != null;
  }
  const container = tryRun('xcrun', ['simctl', 'get_app_container', target.id, appId, 'data']);
  if (container == null) {
    return false;
  }
  const source = path.join(container.trim(), 'Documents', 'perf-lab', `${runId}.json`);
  return tryRun('cp', [source, destination]) != null;
}

/**
 * Drives real touch input for gesture scenarios. Android only: `adb shell
 * input swipe` for pans and double taps for zoom-ins (adb cannot pinch).
 */
export async function performGestures(target, name, durationMs, log) {
  if (target.platform !== 'android') {
    log(`gesture window "${name}" (${durationMs} ms): no touch driver for ${target.platform}; perform the gesture by hand`);
    return;
  }
  const size = screenSize(target) ?? { width: 1080, height: 2400 };
  const cx = Math.round(size.width / 2);
  const cy = Math.round(size.height / 2);
  const dx = Math.round(size.width * 0.3);
  const dy = Math.round(size.height * 0.2);
  const end = Date.now() + durationMs;
  let index = 0;
  while (Date.now() < end) {
    if (name === 'zoom') {
      if (index % 4 < 3) {
        run(adbPath(), ['-s', target.id, 'shell', 'input', 'tap', String(cx), String(cy)]);
        run(adbPath(), ['-s', target.id, 'shell', 'input', 'tap', String(cx), String(cy)]);
      } else {
        run(adbPath(), ['-s', target.id, 'shell', 'input', 'swipe', String(cx), String(cy - dy), String(cx), String(cy + dy), '300']);
      }
    } else {
      const direction = index % 4;
      const from = [cx - (direction === 0 ? dx : direction === 1 ? -dx : 0), cy - (direction === 2 ? dy : direction === 3 ? -dy : 0)];
      const to = [cx + (direction === 0 ? dx : direction === 1 ? -dx : 0), cy + (direction === 2 ? dy : direction === 3 ? -dy : 0)];
      run(adbPath(), ['-s', target.id, 'shell', 'input', 'swipe', String(from[0]), String(from[1]), String(to[0]), String(to[1]), '250']);
    }
    index += 1;
  }
}
