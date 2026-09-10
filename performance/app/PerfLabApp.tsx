import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MapProvider } from 'react-native-better-maps';
import {
  deviceInfo,
  launchRequest,
  memorySnapshot,
  probesAvailable,
  startFrameRecording,
  stopFrameRecording,
  type DeviceInfo,
} from '../../example/modules/perf-lab';
import { SUITES } from '../perf.config';
import {
  SCENARIOS,
  resolveScenarios,
  type Scenario,
  type ScenarioGroup,
} from '../scenarios';
import { MapHost } from './MapHost';
import { makeRunId, parseRunUrl, type RunRequest } from './deepLink';
import { computeFrameSummary } from './metrics/frameStats';
import { isHermes } from './metrics/hermes';
import {
  startJsThreadRecorder,
  type JsThreadRecorder,
} from './metrics/jsThread';
import { toMB } from './metrics/memory';
import { emit, publishRunFile, publishScenarioResult } from './publish';
import type { BuildInfo, RunFile, ScenarioResult } from './result';
import { runScenario, type MapHostApi } from './runner';

const PLATFORM: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
const PROVIDERS: MapProvider[] =
  Platform.OS === 'ios' ? ['apple', 'google'] : ['google'];
const GROUPS: ScenarioGroup[] = [
  'markers',
  'camera',
  'mutations',
  'geometry',
  'clustering',
  'combined',
  'stability',
];

function makeBuildInfo(device: DeviceInfo): BuildInfo {
  const caveats: string[] = [];
  if (device.isDebugBuild) {
    caveats.push(
      'debug native build: no compiler optimizations, debug checks enabled',
    );
  }
  if (__DEV__) {
    caveats.push(
      'development JS bundle: dev-mode React checks and Metro overhead',
    );
  }
  if (device.isSimulator) {
    caveats.push(
      'simulator/emulator: desktop CPU and GPU, 60 Hz; not a device measurement',
    );
  }
  const perfProbes = probesAvailable();
  if (!perfProbes) {
    caveats.push(
      'library built without PerfProbe: native and bridge sections are N/A',
    );
  }
  return {
    type: device.isDebugBuild ? 'debug' : 'release',
    jsDev: __DEV__,
    hermes: isHermes(),
    perfProbes,
    representative: !device.isDebugBuild && !__DEV__ && !device.isSimulator,
    caveats,
  };
}

interface ManualRecording {
  js: JsThreadRecorder;
  beforeBytes: number;
  startedAt: number;
}

/**
 * Performance lab screen. Enabled with `EXPO_PUBLIC_PERF_LAB=1`; the demo app
 * is untouched otherwise. Runs are started from the buttons or from a deep
 * link (`nitromapsperf://run?scenarios=…`), which is how `bun perf run`
 * drives it. Results go to the system log and a result file the CLI pulls.
 */
export default function PerfLabApp() {
  const insets = useSafeAreaInsets();
  const hostRef = useRef<MapHostApi>(null);
  const runningRef = useRef(false);
  const pendingRequest = useRef<RunRequest | null>(null);
  const manual = useRef<ManualRecording | null>(null);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [build, setBuild] = useState<BuildInfo | null>(null);
  const [provider, setProvider] = useState<MapProvider>(PROVIDERS[0]);
  const [group, setGroup] = useState<ScenarioGroup>('markers');
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['markers-10k']),
  );
  const [running, setRunning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('Idle');
  const [lines, setLines] = useState<string[]>([]);
  const [lastRun, setLastRun] = useState<RunFile | null>(null);

  useEffect(() => {
    deviceInfo()
      .then((info) => {
        setDevice(info);
        setBuild(makeBuildInfo(info));
      })
      .catch((error) => setStatus(`deviceInfo failed: ${String(error)}`));
  }, []);

  const appendLine = useCallback((line: string) => {
    setLines((current) => [...current.slice(-40), line]);
  }, []);

  const runRequest = useCallback(
    async (request: RunRequest) => {
      const host = hostRef.current;
      if (host == null || device == null || build == null) {
        pendingRequest.current = request;
        return;
      }
      if (runningRef.current) {
        await emit({ event: 'busy', runId: request.runId ?? null });
        return;
      }
      let scenarios: Scenario[];
      try {
        const selectors =
          request.suite != null ? SUITES[request.suite] : request.scenarios;
        if (selectors == null) {
          throw new Error(`unknown suite "${request.suite}"`);
        }
        scenarios = resolveScenarios(selectors);
      } catch (error) {
        setStatus(String(error));
        await emit({
          event: 'error',
          runId: request.runId ?? null,
          message: String(error),
        });
        return;
      }
      const list: Scenario[] = [];
      for (let repeat = 0; repeat < request.repeat; repeat += 1) {
        list.push(...scenarios);
      }
      const runId = request.runId ?? makeRunId();
      const runProvider =
        (request.provider as MapProvider | undefined) ?? provider;
      runningRef.current = true;
      setRunning(true);
      setLines([]);
      const startedAt = new Date().toISOString();
      const results: ScenarioResult[] = [];
      const failures: RunFile['failures'] = [];
      await emit({
        event: 'run-start',
        runId,
        label: request.label ?? null,
        suite: request.suite ?? null,
        scenarios: list.map((scenario) => scenario.id),
        device: `${device.manufacturer} ${device.model}`,
        build: build.type,
        jsDev: build.jsDev,
        probes: build.perfProbes,
      });
      for (let index = 0; index < list.length; index += 1) {
        const scenario = list[index];
        setStatus(`${index + 1}/${list.length} ${scenario.id}`);
        await emit({
          event: 'scenario-start',
          runId,
          scenario: scenario.id,
          index,
          total: list.length,
        });
        try {
          const result = await runScenario(scenario, host, {
            runId,
            label: request.label,
            platform: PLATFORM,
            provider: runProvider,
            device,
            build,
            onStatus: setStatus,
            emit,
          });
          results.push(result);
          await publishScenarioResult(result);
          appendLine(
            `${scenario.id}: ${result.frames.fps.average} fps · p95 ${result.frames.frameTimeMs.p95} ms · worst ${result.frames.frameTimeMs.worst} ms · jank ${(result.frames.jankRatio * 100).toFixed(1)} % · js p95 ${result.js.lagMs.p95} ms · mem ${result.memory.afterInteractionMB ?? '?'} MB`,
          );
        } catch (error) {
          failures.push({ scenario: scenario.id, error: String(error) });
          appendLine(`${scenario.id}: FAILED ${String(error)}`);
          await emit({
            event: 'scenario-failed',
            runId,
            scenario: scenario.id,
            error: String(error),
          });
        }
      }
      const run: RunFile = {
        schemaVersion: 1,
        runId,
        label: request.label,
        suite: request.suite,
        startedAt,
        finishedAt: new Date().toISOString(),
        platform: PLATFORM,
        provider: runProvider,
        device,
        build,
        scenarios: list.map((scenario) => scenario.id),
        results,
        failures,
      };
      setStatus('Publishing');
      const path = await publishRunFile(run);
      setLastRun(run);
      setStatus(
        `Done: ${results.length} results, ${failures.length} failures → ${path}`,
      );
      runningRef.current = false;
      setRunning(false);
    },
    [appendLine, build, device, provider],
  );

  useEffect(() => {
    if (device == null || build == null) {
      return;
    }
    const pending = pendingRequest.current;
    if (pending != null) {
      pendingRequest.current = null;
      void runRequest(pending);
      return;
    }
    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        const request = parseRunUrl(url) ?? parseRunUrl(launchRequest());
        if (request != null && !cancelled) {
          void runRequest(request);
        }
      })
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const request = parseRunUrl(url);
      if (request != null) {
        void runRequest(request);
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [build, device, runRequest]);

  const toggleManualRecording = useCallback(async () => {
    const active = manual.current;
    if (active == null) {
      const before = await memorySnapshot();
      manual.current = {
        js: startJsThreadRecorder(
          1000 / Math.max(30, device?.refreshRateHz ?? 60),
        ),
        beforeBytes: before.footprintBytes,
        startedAt: performance.now(),
      };
      await startFrameRecording();
      setRecording(true);
      setStatus('Recording: gesture on the map, then tap Stop');
      return;
    }
    manual.current = null;
    setRecording(false);
    const frames = computeFrameSummary(await stopFrameRecording());
    const js = active.js.stop();
    const after = await memorySnapshot();
    const summary = {
      event: 'manual-result',
      scenario: 'manual',
      fps: frames.fps.average,
      fpsP95: frames.fps.p95,
      p50: frames.frameTimeMs.p50,
      p95: frames.frameTimeMs.p95,
      p99: frames.frameTimeMs.p99,
      worst: frames.frameTimeMs.worst,
      jank: frames.jankRatio,
      jsLagP95: js.lagMs.p95,
      memBeforeMB: toMB(active.beforeBytes),
      memAfterMB: toMB(after.footprintBytes),
      durationMs: frames.durationMs,
    };
    await emit(summary);
    appendLine(
      `manual: ${frames.fps.average} fps · p95 ${frames.frameTimeMs.p95} ms · worst ${frames.frameTimeMs.worst} ms · jank ${(frames.jankRatio * 100).toFixed(1)} %`,
    );
    setStatus('Manual recording done');
  }, [appendLine, device]);

  const mountSelectedForManual = useCallback(async () => {
    const host = hostRef.current;
    const id = Array.from(selected)[0];
    const scenario =
      id != null ? SCENARIOS.find((entry) => entry.id === id) : undefined;
    if (host == null || scenario == null) {
      return;
    }
    setStatus(`Mounting ${scenario.id} for manual recording`);
    await host.mount(scenario.props(), provider);
    setStatus(`${scenario.id} mounted; tap Record, gesture, then Stop`);
  }, [provider, selected]);

  const shareLastRun = useCallback(async () => {
    if (lastRun == null) {
      return;
    }
    await Share.share({ message: JSON.stringify(lastRun) });
  }, [lastRun]);

  const visibleScenarios = useMemo(
    () => SCENARIOS.filter((scenario) => scenario.group === group),
    [group],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const headline = device
    ? `${device.manufacturer} ${device.model} · ${PLATFORM} ${device.osVersion} · ${device.refreshRateHz} Hz`
    : 'Loading device info';
  const buildLine = build
    ? `${build.type}${build.jsDev ? ' + dev JS' : ''}${build.hermes ? ' · hermes' : ''}${build.perfProbes ? ' · probes' : ' · no probes'}${build.representative ? ' · REPRESENTATIVE' : ' · NOT REPRESENTATIVE'}`
    : '';

  return (
    <View style={styles.root}>
      <MapHost ref={hostRef} initialProvider={PROVIDERS[0]} />
      <View
        style={[styles.header, { paddingTop: insets.top + 6 }]}
        pointerEvents="box-none"
      >
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.buildLine}>{buildLine}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      {running ? (
        <View
          style={[styles.runningPanel, { paddingBottom: insets.bottom + 8 }]}
        >
          {lines.slice(-6).map((line, index) => (
            <Text key={index} style={styles.resultLine} numberOfLines={2}>
              {line}
            </Text>
          ))}
        </View>
      ) : (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 8 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {PROVIDERS.length > 1 &&
              PROVIDERS.map((entry) => (
                <Chip
                  key={entry}
                  label={entry}
                  active={entry === provider}
                  onPress={() => setProvider(entry)}
                />
              ))}
            {GROUPS.map((entry) => (
              <Chip
                key={entry}
                label={entry}
                active={entry === group}
                onPress={() => setGroup(entry)}
              />
            ))}
          </ScrollView>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            {visibleScenarios.map((scenario) => (
              <Pressable
                key={scenario.id}
                onPress={() => toggleSelected(scenario.id)}
                style={[
                  styles.row,
                  selected.has(scenario.id) && styles.rowActive,
                ]}
              >
                <Text style={styles.rowId}>{scenario.id}</Text>
                <Text style={styles.rowName} numberOfLines={2}>
                  {scenario.name} · {scenario.tags.join(', ') || 'untagged'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.buttonRow}>
            <Button
              label={`Run ${selected.size}`}
              onPress={() =>
                void runRequest({ scenarios: Array.from(selected), repeat: 1 })
              }
            />
            <Button
              label="Quick"
              onPress={() =>
                void runRequest({ scenarios: [], suite: 'quick', repeat: 1 })
              }
            />
            <Button
              label="Baseline"
              onPress={() =>
                void runRequest({ scenarios: [], suite: 'baseline', repeat: 1 })
              }
            />
          </View>
          <View style={styles.buttonRow}>
            <Button
              label="Mount"
              onPress={() => void mountSelectedForManual()}
            />
            <Button
              label={recording ? 'Stop' : 'Record'}
              onPress={() => void toggleManualRecording()}
            />
            <Button
              label="Share"
              onPress={() => void shareLastRun()}
              disabled={lastRun == null}
            />
          </View>
          {lines.length > 0 && (
            <ScrollView style={styles.results}>
              {lines.map((line, index) => (
                <Text key={index} style={styles.resultLine}>
                  {line}
                </Text>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101012' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'rgba(16, 16, 18, 0.82)',
  },
  headline: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  buildLine: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2 },
  status: {
    color: '#FBBF24',
    fontSize: 11,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '52%',
    backgroundColor: 'rgba(16, 16, 18, 0.92)',
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 8,
  },
  runningPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 16, 18, 0.82)',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  chipRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(59, 130, 246, 0.4)' },
  chipText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  list: { maxHeight: 200 },
  listContent: { gap: 4 },
  row: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rowActive: { backgroundColor: 'rgba(59, 130, 246, 0.35)' },
  rowId: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  rowName: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  results: { maxHeight: 120 },
  resultLine: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});
