#!/usr/bin/env bun
/**
 * Performance lab CLI. `bun perf help` lists the commands.
 *
 * Runs are executed by the lab build of the example app on a device; this
 * script starts them through a deep link, follows the device log for
 * progress, pulls the result file and stores it under performance/results.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REGRESSION_THRESHOLDS, SUITES } from '../perf.config.ts';
import { catalog, resolveScenarios } from '../scenarios/index.ts';
import {
  checkRegressions,
  compareRuns,
  formatDetail,
  formatOverview,
  scorecard,
  stepsTable,
  timelineTable,
} from './lib/compare.mjs';
import { digestTable, transferTable } from './lib/digest.mjs';
import { evidence } from './lib/evidence.mjs';
import {
  isAppInstalled,
  listDevices,
  performGestures,
  prepareTarget,
  pullResultFile,
  resolveTarget,
  startRun,
  terminateApp,
} from './lib/devices.mjs';
import { assembleChunks, startLogTail } from './lib/logs.mjs';
import {
  baselineDirFor,
  baselineDirs,
  latestRunDir,
  loadRun,
  matchingBaseline,
  runDirFor,
  saveRun,
} from './lib/results.mjs';
import {
  APP_ID,
  PERF_DIR,
  REPO_DIR,
  RUNS_DIR,
  URL_SCHEME,
  ensureDir,
  markdownTable,
  parseArgs,
  run as sh,
  sleep,
  timestamp,
} from './lib/util.mjs';

const HELP = `react-native-better-maps performance lab

Usage: bun perf <command> [options]

  list [--group g] [--tag t]        List scenarios (ids, groups, tags, estimated duration).
  devices                           List connected Android devices and booted iOS simulators.
  run <selectors...> [options]      Run scenarios on a device. Selectors: ids, groups, tag:<tag>, prefix*.
      --suite <name>                Run a suite from perf.config.ts (${Object.keys(SUITES).join(', ')}).
      --platform ios|android        Target platform (required when more than one target is available).
      --device <id|name>            adb serial or simulator udid/name.
      --label <text>                Free-form label stored with the run (branch, PR, hypothesis).
      --repeat <n>                  Run every selected scenario n times (n results per scenario).
      --provider apple|google       Map provider (iOS only; Android is always google).
      --timeout <ms>                Override the run timeout.
      --baseline                    Also store the run as the baseline for this device and build.
  baseline [options]                Shorthand for: run --suite baseline --baseline.
  compare [baselineDir] [runDir]    Compare a run against a baseline (defaults: matching baseline, latest run).
      --detail                      Every metric per scenario instead of the overview.
  check [options]                   Like compare, then apply the regression thresholds.
      --fail                        Exit 1 when a regression exceeds its threshold (off by default).
  report [runDir] [--out file]      Markdown scorecard (+ step and timeline tables) for a run.
      --digest                      Add the per-scenario evidence table (load, dominant native spans, retained memory).
      --transfer                    Add the JS → native transfer table (updates, items, coordinates, bytes).
  evidence [runDir]                 JSON with the numbers PERFORMANCE.md cites (mount, mutation steps, clustering, shapes, camera, stability).
  scorecard [--write]               Markdown for every baseline under results/baseline; --write replaces the
                                    RESULTS block in performance/PERFORMANCE.md.
  bench                             JS micro-benchmarks (bun, no device): serialization, collection, geometry.
  fixtures                          Verify fixture determinism (bun test performance/fixtures).
  build android|ios [options]       Build the lab variant of the example app (see performance/README.md).
      --debug                       Debug configuration instead of release.
      --no-probes                   Leave PerfProbe recording out of the library.
      --arch <abi>                  Android ABI (default arm64-v8a).
      --install                     Install on the selected device/simulator after building.
  install android|ios [--device]    Install the last built lab app.
  help                              This text.
`;

function print(text = '') {
  process.stdout.write(`${text}\n`);
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

function buildUrl(params) {
  const query = Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');
  return `${URL_SCHEME}://run?${query}`;
}

function commandList(flags) {
  const entries = catalog().filter(
    (entry) =>
      (flags.group == null || entry.group === flags.group) &&
      (flags.tag == null || entry.tags.includes(flags.tag)),
  );
  print(
    markdownTable(
      ['Id', 'Group', 'Tags', 'Est.', 'Description'],
      entries.map((entry) => [
        entry.id,
        entry.group,
        entry.tags.join(', ') || '-',
        `${Math.round(entry.estimatedDurationMs / 1000)} s`,
        entry.description,
      ]),
    ),
  );
  print(
    `\n${entries.length} scenarios. Suites: ${Object.entries(SUITES)
      .map(
        ([name, selectors]) =>
          `${name} (${resolveScenarios(selectors).length})`,
      )
      .join(', ')}`,
  );
}

function commandDevices() {
  const devices = listDevices();
  if (devices.length === 0) {
    print('No connected Android devices or booted iOS simulators.');
    return;
  }
  print(
    markdownTable(
      ['Platform', 'Id', 'Name', 'Kind'],
      devices.map((device) => [
        device.platform,
        device.id,
        device.name,
        device.simulator ? 'simulator/emulator' : 'device',
      ]),
    ),
  );
}

async function commandRun(positional, flags, { asBaseline = false } = {}) {
  const suite = flags.suite ?? (positional.length === 0 ? 'quick' : undefined);
  const selectors = suite != null ? SUITES[suite] : positional;
  if (selectors == null) {
    fail(`unknown suite "${suite}"; known: ${Object.keys(SUITES).join(', ')}`);
  }
  const scenarios = resolveScenarios(selectors);
  const repeat = Number.parseInt(flags.repeat ?? '1', 10) || 1;
  const estimatedMs =
    scenarios.reduce(
      (sum, scenario) => sum + scenario.estimatedDurationMs + 6000,
      0,
    ) * repeat;
  const timeoutMs =
    Number.parseInt(flags.timeout ?? '0', 10) || estimatedMs * 2 + 90_000;
  const target = resolveTarget({
    platform: flags.platform,
    device: flags.device,
  });
  if (!isAppInstalled(target, APP_ID)) {
    fail(
      `${APP_ID} is not installed on ${target.name}. Build and install the lab app first: bun perf build ${target.platform} --install`,
    );
  }
  const runId = `${timestamp()}-${Math.random().toString(36).slice(2, 6)}`;
  print(`Target: ${target.platform} ${target.name} (${target.id})`);
  print(
    `Run ${runId}: ${scenarios.length} scenario(s) × ${repeat}, timeout ${Math.round(timeoutMs / 1000)} s`,
  );
  print(scenarios.map((scenario) => `  - ${scenario.id}`).join('\n'));

  const chunks = new Map();
  let completion = null;
  let runFile = null;
  let sawStart = false;
  const gestures = [];
  const tail = startLogTail(target, (event) => {
    if (event.runId != null && event.runId !== runId) {
      return;
    }
    if (event.runId === runId) {
      sawStart = true;
    }
    switch (event.event) {
      case 'run-start':
        print(
          `app: run started (${event.device}, ${event.build} build, probes ${event.probes ? 'on' : 'off'})`,
        );
        break;
      case 'scenario-start':
        print(`▶ ${event.scenario} (${event.index + 1}/${event.total})`);
        break;
      case 'scenario-result':
        print(
          `  ${event.scenario}: ${event.fps} fps · p95 ${event.p95} ms · p99 ${event.p99} ms · worst ${event.worst} ms · jank ${(event.jank * 100).toFixed(1)} % · js lag p95 ${event.jsLagP95} ms · commit avg ${event.jsCommitAvg} ms · RAM ${event.memAfterMB} MB (${event.memDeltaMB >= 0 ? '+' : ''}${event.memDeltaMB}) · cpu ${event.cpuPct} %`,
        );
        break;
      case 'scenario-failed':
        print(`  ${event.scenario}: FAILED ${event.error}`);
        break;
      case 'gesture-window':
        gestures.push(
          performGestures(target, event.name, event.durationMs, print),
        );
        break;
      case 'result-chunk':
        chunks.set(event.index, event);
        break;
      case 'run-complete':
        completion = event;
        break;
      case 'error':
        print(`app error: ${event.message}`);
        break;
      case 'busy':
        fail(
          'the app is already running a suite; wait for it or restart the app',
        );
        break;
      default:
        break;
    }
  });

  try {
    // Every run starts from a cold process so memory baselines are comparable
    // and no previous suite can still be running.
    terminateApp(target, APP_ID);
    prepareTarget(target);
    // `log stream` / logcat need a moment to attach or the first events are lost.
    await sleep(target.platform === 'ios' ? 4000 : 1500);
    startRun(
      target,
      APP_ID,
      buildUrl({
        scenarios: suite
          ? undefined
          : scenarios.map((scenario) => scenario.id).join(','),
        suite,
        runId,
        label: flags.label,
        repeat,
        provider: flags.provider,
      }),
    );
    const deadline = Date.now() + timeoutMs;
    while (completion == null && Date.now() < deadline) {
      await sleep(500);
      if (!sawStart && Date.now() - (deadline - timeoutMs) > 30_000) {
        fail(
          'the app did not acknowledge the run within 30 s. Is it the lab build (EXPO_PUBLIC_PERF_LAB=1) and in the foreground?',
        );
      }
    }
    await Promise.all(gestures);
    if (completion == null) {
      fail(
        `timed out after ${Math.round(timeoutMs / 1000)} s waiting for run-complete`,
      );
    }
    await sleep(500);
    const tmpFile = path.join(
      ensureDir(path.join(RUNS_DIR, '.tmp')),
      `${runId}.json`,
    );
    if (pullResultFile(target, APP_ID, runId, tmpFile) && existsSync(tmpFile)) {
      runFile = JSON.parse(readFileSync(tmpFile, 'utf8'));
    } else {
      runFile = assembleChunks(chunks);
      if (runFile == null) {
        fail(
          'could not pull the result file and the log chunks were incomplete',
        );
      }
      print('(result file pulled from log chunks)');
    }
  } finally {
    tail.stop();
  }

  const dir = saveRun(runFile, runDirFor(runFile));
  writeFileSync(path.join(dir, 'summary.md'), renderReport(runFile));
  print(
    `\nSaved ${runFile.results.length} result(s) to ${path.relative(REPO_DIR, dir)}`,
  );
  if (asBaseline || flags.baseline) {
    const baselineDir = saveRun(runFile, baselineDirFor(runFile));
    writeFileSync(path.join(baselineDir, 'summary.md'), renderReport(runFile));
    print(`Stored as baseline: ${path.relative(REPO_DIR, baselineDir)}`);
  }
  print('');
  print(renderReport(runFile));
}

function renderReport(runFile) {
  const { run, results } = loadRunObject(runFile);
  const device = run.device ?? {};
  const build = run.build ?? {};
  const lines = [];
  lines.push(
    `Run ${run.runId}${run.label ? ` (${run.label})` : ''} · ${run.platform} ${device.osVersion ?? ''} · ${device.manufacturer ?? ''} ${device.model ?? ''} · ${device.refreshRateHz ?? '?'} Hz · provider ${run.provider}`,
  );
  lines.push(
    `Build: ${build.type}${build.jsDev ? ' + dev JS' : ''}${build.hermes ? ', Hermes' : ''}${build.perfProbes ? ', probes' : ', no probes'} · ${build.representative ? 'REPRESENTATIVE' : 'NOT production-representative'}${(build.caveats ?? []).length ? ` (${build.caveats.join('; ')})` : ''}`,
  );
  lines.push(`Recorded ${run.startedAt} → ${run.finishedAt}`);
  lines.push('');
  lines.push(scorecard(results));
  for (const result of results.values()) {
    if ((result.steps ?? []).length > 0) {
      const steps = stepsTable(result);
      lines.push(
        '',
        `#### ${result.scenario} steps (median over repeats)`,
        '',
        steps.table,
      );
      if (steps.exponent != null) {
        lines.push(
          '',
          `JS commit cost vs. changed markers: empirical exponent ${steps.exponent.toFixed(2)} (0 = flat, 1 = linear).`,
        );
      }
    }
    const timeline = timelineTable(result);
    if (timeline != null) {
      lines.push('', `#### ${result.scenario} timeline`, '', timeline.table);
      lines.push(
        '',
        `Drift first → last window: FPS ${timeline.drift.fps == null ? 'N/A' : timeline.drift.fps.toFixed(1)}, RAM ${timeline.drift.memoryMB == null ? 'N/A' : `${timeline.drift.memoryMB.toFixed(0)} MB`}.`,
      );
    }
    if ((result.errors ?? []).length > 0) {
      lines.push('', `${result.scenario} errors: ${result.errors.join('; ')}`);
    }
  }
  if ((run.failures ?? []).length > 0) {
    lines.push(
      '',
      `Failures: ${run.failures.map((failure) => `${failure.scenario} (${failure.error})`).join(', ')}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function loadRunObject(runFile) {
  const results = new Map();
  for (const result of runFile.results ?? []) {
    if (!results.has(result.scenario)) {
      results.set(result.scenario, result);
    }
  }
  return { run: runFile, results };
}

function resolveComparison(positional, flags) {
  let currentDir = positional[1] ?? flags.current ?? null;
  let baselineDir = positional[0] ?? flags.baseline ?? null;
  if (positional.length === 1 && baselineDir != null && !flags.baseline) {
    // A single positional argument is the current run.
    currentDir = baselineDir;
    baselineDir = null;
  }
  if (currentDir == null) {
    currentDir = latestRunDir(flags.platform);
    if (currentDir == null) {
      fail('no runs under performance/results/runs; run something first');
    }
  }
  const current = loadRun(currentDir);
  if (baselineDir == null) {
    baselineDir = matchingBaseline(current.run);
    if (baselineDir == null) {
      fail(
        `no baseline for ${current.run.platform} / ${current.run.device?.model}. Known baselines: ${
          baselineDirs()
            .map((dir) => path.relative(PERF_DIR, dir))
            .join(', ') || 'none'
        }. Record one with bun perf baseline.`,
      );
    }
  }
  const baseline = loadRun(baselineDir);
  print(
    `Baseline: ${path.relative(REPO_DIR, baseline.dir)} (${baseline.run.runId})`,
  );
  print(
    `Current:  ${path.relative(REPO_DIR, current.dir)} (${current.run.runId})`,
  );
  if (
    baseline.run.device?.model !== current.run.device?.model ||
    baseline.run.build?.type !== current.run.build?.type
  ) {
    print(
      'warning: baseline and current differ in device or build type; numbers are not directly comparable',
    );
  }
  return compareRuns(baseline, current, {
    minAbsoluteMs: REGRESSION_THRESHOLDS.minAbsoluteMs,
  });
}

function commandCompare(positional, flags) {
  const comparison = resolveComparison(positional, flags);
  print('');
  print(flags.detail ? formatDetail(comparison) : formatOverview(comparison));
  if (comparison.missing.length > 0) {
    print(`\nNot in baseline: ${comparison.missing.join(', ')}`);
  }
}

function commandCheck(positional, flags) {
  const comparison = resolveComparison(positional, flags);
  const verdict = checkRegressions(comparison, REGRESSION_THRESHOLDS);
  print('');
  print(
    formatOverview(comparison, [
      'fps',
      'p95',
      'p99',
      'jank',
      'jsCommit',
      'setter',
      'memAfter',
    ]),
  );
  print('');
  if (verdict.regressions.length === 0) {
    print('No regressions beyond the thresholds.');
  } else {
    print(`${verdict.regressions.length} regression(s):`);
    print(
      markdownTable(
        ['Scenario', 'Metric', 'Baseline', 'Current', 'Change', 'Threshold'],
        verdict.regressions.map((entry) => [
          entry.scenario,
          entry.label,
          entry.baseline,
          entry.current,
          entry.change,
          entry.threshold,
        ]),
      ),
    );
  }
  if (verdict.improvements.length > 0) {
    print(
      `\n${verdict.improvements.length} improvement(s) beyond the thresholds: ${verdict.improvements.map((entry) => `${entry.scenario}/${entry.metric} ${entry.change}`).join(', ')}`,
    );
  }
  if (verdict.skipped.length > 0) {
    print(`\nSkipped (N/A on one side): ${verdict.skipped.length} metric(s)`);
  }
  if (verdict.regressions.length > 0 && flags.fail) {
    process.exit(1);
  }
}

function commandReport(positional, flags) {
  const dir = positional[0] ?? latestRunDir(flags.platform);
  if (dir == null) {
    fail('no run directory');
  }
  const { run, results } = loadRun(dir);
  let report = renderReport(run);
  if (flags.digest) {
    report += `\n#### Evidence per scenario\n\n${digestTable(results)}\n`;
  }
  if (flags.transfer) {
    report += `\n#### JS → native transfer\n\n${transferTable(results)}\n`;
  }
  if (flags.out) {
    writeFileSync(flags.out, report);
    print(`wrote ${flags.out}`);
  } else {
    print(report);
  }
}

function commandBench() {
  const outDir = ensureDir(path.join(PERF_DIR, 'results', 'bench'));
  print(
    `JS micro-benchmarks (bun ${process.versions.bun ?? ''}); output in ${path.relative(REPO_DIR, outDir)}`,
  );
  sh('bun', ['test', 'performance/benchmarks', '--timeout', '600000'], {
    cwd: REPO_DIR,
    stdio: 'inherit',
  });
}

function commandFixtures() {
  sh('bun', ['test', 'performance/fixtures'], {
    cwd: REPO_DIR,
    stdio: 'inherit',
  });
}

function commandBuild(positional, flags) {
  const platform = positional[0];
  if (platform !== 'android' && platform !== 'ios') {
    fail('usage: bun perf build android|ios');
  }
  const script = path.join(PERF_DIR, 'scripts', `build-${platform}.sh`);
  const args = [
    flags.debug ? 'debug' : 'release',
    flags['no-probes'] ? '0' : '1',
  ];
  if (platform === 'android') {
    args.push(flags.arch ?? 'arm64-v8a');
  }
  sh('bash', [script, ...args], { cwd: REPO_DIR, stdio: 'inherit' });
  if (flags.install) {
    commandInstall([platform], flags);
  }
}

function commandInstall(positional, flags) {
  const platform = positional[0];
  const target = resolveTarget({ platform, device: flags.device });
  if (platform === 'android') {
    const variant = flags.debug ? 'debug' : 'release';
    const apk = path.join(
      REPO_DIR,
      'example/android/app/build/outputs/apk',
      variant,
      `app-${variant}.apk`,
    );
    if (!existsSync(apk)) {
      fail(`${apk} not found; build first`);
    }
    sh(
      path.join(
        process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`,
        'platform-tools/adb',
      ),
      ['-s', target.id, 'install', '-r', apk],
      { stdio: 'inherit' },
    );
  } else {
    const config = flags.debug ? 'Debug' : 'Release';
    const app = path.join(
      REPO_DIR,
      'example/ios/build/perf-lab/Build/Products',
      `${config}-iphonesimulator`,
      'NitroMapsExample.app',
    );
    if (!existsSync(app)) {
      fail(`${app} not found; build first`);
    }
    sh('xcrun', ['simctl', 'install', target.id, app], { stdio: 'inherit' });
  }
  print(`Installed on ${target.name}`);
}

/** Renders every stored baseline as the RESULTS section of PERFORMANCE.md. */
function commandScorecard(flags) {
  const sections = [];
  for (const dir of baselineDirs()) {
    const { run, results } = loadRun(dir);
    const device = run.device ?? {};
    const build = run.build ?? {};
    const title = `${run.platform === 'ios' ? 'iOS' : 'Android'} · ${device.manufacturer ?? ''} ${device.model ?? ''} (${device.isSimulator ? 'simulator/emulator' : 'device'}) · ${run.platform} ${device.osVersion ?? ''} · ${device.refreshRateHz ?? '?'} Hz · provider ${run.provider}`;
    const lines = [`### ${title}`, ''];
    lines.push(
      `- Build: **${build.type}**${build.jsDev ? ' + dev JS' : ', production JS'}${build.hermes ? ', Hermes' : ''}${build.perfProbes ? ', PerfProbe on (profile build)' : ', no probes'}.`,
    );
    lines.push(
      `- ${build.representative ? '**Representative** (release build on a physical device).' : `**Not production-representative**: ${(build.caveats ?? []).join('; ')}.`}`,
    );
    lines.push(
      `- Run \`${run.runId}\`${run.label ? ` — ${run.label}` : ''}, recorded ${run.startedAt} → ${run.finishedAt}; results in \`${path.relative(PERF_DIR, dir)}/\`.`,
    );
    lines.push('', scorecard(results), '');
    for (const result of results.values()) {
      if ((result.steps ?? []).length > 0 && result.group === 'mutations') {
        const steps = stepsTable(result);
        const byChanged = result.steps.some(
          (step) => typeof step.meta?.changed === 'number',
        );
        lines.push(
          `#### ${result.scenario} — ${byChanged ? 'update cost by number of changed markers (median over repeats)' : 'steps'}`,
          '',
          steps.table,
          '',
        );
        if (steps.exponent != null) {
          lines.push(
            `JS commit vs. changed markers: empirical exponent ${steps.exponent.toFixed(2)} (0 = independent of how many changed, 1 = linear).`,
            '',
          );
        }
      }
      const timeline = timelineTable(result);
      if (timeline != null) {
        lines.push(
          `#### ${result.scenario} — timeline`,
          '',
          timeline.table,
          '',
          `Drift first → last window: FPS ${timeline.drift.fps == null ? 'N/A' : timeline.drift.fps.toFixed(1)}, RAM ${timeline.drift.memoryMB == null ? 'N/A' : `${timeline.drift.memoryMB.toFixed(0)} MB`}; retained after unmount ${result.memory?.retainedAfterCleanupMB ?? 'N/A'} MB.`,
          '',
        );
      }
    }
    lines.push('#### Evidence per scenario', '', digestTable(results), '');
    lines.push('#### JS → native transfer', '', transferTable(results), '');
    sections.push(lines.join('\n'));
  }
  const body = sections.join('\n');
  if (flags.write) {
    const file = path.join(PERF_DIR, 'PERFORMANCE.md');
    const doc = readFileSync(file, 'utf8');
    const begin = doc.indexOf('<!-- RESULTS:BEGIN -->');
    const end = doc.indexOf('<!-- RESULTS:END -->');
    if (begin < 0 || end < 0) {
      fail('PERFORMANCE.md is missing the RESULTS markers');
    }
    writeFileSync(
      file,
      `${doc.slice(0, begin)}<!-- RESULTS:BEGIN -->\n${body}\n${doc.slice(end)}`,
    );
    print(
      `updated ${path.relative(REPO_DIR, file)} with ${sections.length} baseline(s)`,
    );
    return;
  }
  print(body);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const command = positional.shift() ?? 'help';
  switch (command) {
    case 'list':
      return commandList(flags);
    case 'devices':
      return commandDevices();
    case 'run':
      return commandRun(positional, flags);
    case 'baseline':
      return commandRun(
        positional,
        { ...flags, suite: flags.suite ?? 'baseline' },
        { asBaseline: true },
      );
    case 'compare':
      return commandCompare(positional, flags);
    case 'check':
      return commandCheck(positional, flags);
    case 'report':
      return commandReport(positional, flags);
    case 'scorecard':
      return commandScorecard(flags);
    case 'evidence': {
      const dir = positional[0] ?? latestRunDir(flags.platform);
      if (dir == null) {
        fail('no run directory');
      }
      print(JSON.stringify(evidence(loadRun(dir).results), null, 2));
      return undefined;
    }
    case 'bench':
      return commandBench();
    case 'fixtures':
      return commandFixtures();
    case 'build':
      return commandBuild(positional, flags);
    case 'install':
      return commandInstall(positional, flags);
    case 'help':
    default:
      print(HELP);
      return undefined;
  }
}

main().catch((error) => fail(error?.stack ?? String(error)));
