import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { BASELINE_DIR, RUNS_DIR, ensureDir, readJson, slug, writeJson } from './util.mjs';

export function deviceSlug(run) {
  const device = run.device ?? {};
  return slug(`${device.manufacturer ?? ''}-${device.model ?? 'unknown'}`);
}

export function buildSlug(run) {
  const build = run.build ?? {};
  return `${build.type ?? 'unknown'}${build.jsDev ? '-devjs' : ''}${build.perfProbes ? '-probes' : ''}`;
}

/** Writes `run.json` plus one file per scenario into `dir`. */
export function saveRun(run, dir) {
  ensureDir(dir);
  writeJson(path.join(dir, 'run.json'), run);
  for (const result of run.results) {
    writeJson(path.join(dir, `${result.scenario}.json`), result);
  }
  return dir;
}

export function runDirFor(run) {
  return path.join(RUNS_DIR, `${run.runId}-${run.platform}-${deviceSlug(run)}`);
}

export function baselineDirFor(run) {
  return path.join(BASELINE_DIR, run.platform, `${deviceSlug(run)}-${buildSlug(run)}`);
}

/** Loads a run directory (or a single run.json) into `{ run, results: Map<scenario, result> }`. */
export function loadRun(target) {
  const file = target.endsWith('.json') ? target : path.join(target, 'run.json');
  if (!existsSync(file)) {
    throw new Error(`No run.json in ${target}`);
  }
  const run = readJson(file);
  const results = new Map();
  for (const result of run.results ?? []) {
    // Keep the first occurrence per scenario when a run repeated scenarios.
    if (!results.has(result.scenario)) {
      results.set(result.scenario, result);
    }
  }
  return { run, results, dir: path.dirname(file) };
}

export function latestRunDir(platform) {
  if (!existsSync(RUNS_DIR)) {
    return null;
  }
  const dirs = readdirSync(RUNS_DIR)
    .filter((name) => platform == null || name.includes(`-${platform}-`))
    .sort();
  return dirs.length > 0 ? path.join(RUNS_DIR, dirs[dirs.length - 1]) : null;
}

export function baselineDirs() {
  if (!existsSync(BASELINE_DIR)) {
    return [];
  }
  const dirs = [];
  for (const platform of readdirSync(BASELINE_DIR)) {
    const platformDir = path.join(BASELINE_DIR, platform);
    if (!existsSync(path.join(platformDir))) {
      continue;
    }
    for (const entry of readdirSync(platformDir, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(path.join(platformDir, entry.name, 'run.json'))) {
        dirs.push(path.join(platformDir, entry.name));
      }
    }
  }
  return dirs;
}

/** Picks the baseline recorded on the same platform/device/build as `run`. */
export function matchingBaseline(run) {
  const wanted = baselineDirFor(run);
  if (existsSync(path.join(wanted, 'run.json'))) {
    return wanted;
  }
  const sameDevice = baselineDirs().filter((dir) => dir.includes(path.join(run.platform, deviceSlug(run))));
  return sameDevice[0] ?? null;
}
