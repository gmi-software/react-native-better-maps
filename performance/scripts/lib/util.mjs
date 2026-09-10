import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PERF_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO_DIR = path.resolve(PERF_DIR, '..');
export const RESULTS_DIR = path.join(PERF_DIR, 'results');
export const RUNS_DIR = path.join(RESULTS_DIR, 'runs');
export const BASELINE_DIR = path.join(RESULTS_DIR, 'baseline');
export const APP_ID = 'com.nitromaps.example';
export const URL_SCHEME = 'nitromapsperf';

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=');
      if (inline !== undefined) {
        flags[key] = inline;
      } else if (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
        flags[key] = argv[index + 1];
        index += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

export function tryRun(command, args, options = {}) {
  try {
    return run(command, args, options);
  } catch {
    return null;
  }
}

export function spawnProcess(command, args, options = {}) {
  return spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  ensureDir(path.dirname(file));
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function listRunDirs(root) {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatMs(value, digits = 1) {
  return value == null || Number.isNaN(value) ? 'N/A' : `${Number(value).toFixed(digits)} ms`;
}

export function formatNumber(value, digits = 1) {
  return value == null || Number.isNaN(value) ? 'N/A' : Number(value).toFixed(digits);
}

export function formatPct(value, digits = 1) {
  return value == null || Number.isNaN(value) ? 'N/A' : `${(Number(value) * 100).toFixed(digits)} %`;
}

export function formatBytes(value) {
  if (value == null || Number.isNaN(value)) {
    return 'N/A';
  }
  const abs = Math.abs(value);
  if (abs >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (abs >= 1024) {
    return `${(value / 1024).toFixed(0)} KB`;
  }
  return `${value} B`;
}

/** Renders rows as a GitHub-flavoured Markdown table. */
export function markdownTable(headers, rows, align = []) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const separator = headers.map((_, index) => (align[index] === 'right' ? '---:' : '---'));
  return [line(headers), line(separator), ...rows.map(line)].join('\n');
}
