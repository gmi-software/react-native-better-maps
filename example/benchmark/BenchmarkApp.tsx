import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MapView,
  type MapProvider,
  type MapViewRef,
} from 'react-native-better-maps';
import {
  displayRefreshRateHz,
  memoryFootprintBytes,
  startFrameRecording,
  stopFrameRecording,
} from '../modules/frame-stats';
import { computeFrameStats } from './frameStats';
import { startJsLagSampler, type LagSampler } from './jsLagSampler';
import {
  formatResultLine,
  publishResult,
  runScenario,
  type ScenarioResult,
} from './runner';
import {
  SCENARIOS,
  SKIPPED_SCENARIOS,
  type BenchmarkMapProps,
  type BenchmarkScenario,
  type ScenarioContext,
} from './scenarios';
import { evaluateFrameStats } from './thresholds';

type BenchmarkProvider = Extract<MapProvider, 'apple' | 'google'>;

const PROVIDERS: BenchmarkProvider[] =
  Platform.OS === 'ios' ? ['apple', 'google'] : ['google'];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits for React to commit pending state and for the next frame to start. */
function nextCommit(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => requestAnimationFrame(() => resolve()), 0);
  });
}

/**
 * Benchmark harness screen. Enabled with `EXPO_PUBLIC_BENCHMARK=1`; the demo
 * app is untouched otherwise.
 *
 * "Run all" mounts each scenario in turn, drives it with animated camera moves
 * and prop updates, and records main-thread frame intervals, JS-thread lag and
 * memory. "Record" is the manual mode for real gestures (Maestro flows use it).
 */
export default function BenchmarkApp() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewRef>(null);
  const [provider, setProvider] = useState<BenchmarkProvider>(PROVIDERS[0]);
  const [manualActive, setManualActive] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [mapProps, setMapProps] = useState<BenchmarkMapProps>(() =>
    SCENARIOS[0].props(),
  );
  const [mapKey, setMapKey] = useState(0);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [status, setStatus] = useState('Idle');
  const [running, setRunning] = useState(false);
  const [refreshRate, setRefreshRate] = useState<number | null>(null);
  const readyResolver = useRef<(() => void) | null>(null);
  const manualRecording = useRef<{
    lag: LagSampler;
    beforeBytes: number;
  } | null>(null);

  const scenario = SCENARIOS[scenarioIndex];

  useEffect(() => {
    displayRefreshRateHz()
      .then(setRefreshRate)
      .catch(() => setRefreshRate(null));
  }, []);

  const handleMapReady = useCallback(() => {
    readyResolver.current?.();
    readyResolver.current = null;
  }, []);

  const mount = useCallback((next: BenchmarkScenario) => {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 10_000);
      readyResolver.current = () => {
        clearTimeout(timeout);
        resolve();
      };
      setMapProps(next.props());
      setMapKey((key) => key + 1);
    });
  }, []);

  const context = useMemo<ScenarioContext>(
    () => ({
      map: () => mapRef.current,
      async setProps(patch) {
        setMapProps((current) => ({ ...current, ...patch }));
        await nextCommit();
      },
      sleep,
    }),
    [],
  );

  const appendResult = useCallback((result: ScenarioResult) => {
    setResults((current) => [...current, result]);
  }, []);

  const runAll = useCallback(async () => {
    if (running) {
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      for (let index = 0; index < SCENARIOS.length; index += 1) {
        setScenarioIndex(index);
        const result = await runScenario(SCENARIOS[index], {
          provider,
          mount,
          context,
          onStatus: setStatus,
        });
        appendResult(result);
      }
      setStatus('Done');
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  }, [appendResult, context, mount, provider, running]);

  const runOne = useCallback(async () => {
    if (running) {
      return;
    }
    setRunning(true);
    try {
      appendResult(
        await runScenario(scenario, {
          provider,
          mount,
          context,
          onStatus: setStatus,
        }),
      );
      setStatus('Done');
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
    } finally {
      setRunning(false);
    }
  }, [appendResult, context, mount, provider, running, scenario]);

  const toggleManualRecording = useCallback(async () => {
    const active = manualRecording.current;
    if (active == null) {
      const beforeBytes = await memoryFootprintBytes();
      manualRecording.current = { lag: startJsLagSampler(), beforeBytes };
      await startFrameRecording();
      setManualActive(true);
      setStatus('Recording: gesture now, then tap Stop');
      return;
    }

    manualRecording.current = null;
    setManualActive(false);
    const recording = await stopFrameRecording();
    const jsLag = active.lag.stop();
    const afterBytes = await memoryFootprintBytes();
    const frames = computeFrameStats(recording);
    const MB = 1024 * 1024;
    const result: ScenarioResult = {
      id: `manual-${scenario.id}`,
      name: `Manual · ${scenario.name}`,
      platform: Platform.OS,
      provider,
      recordedAt: new Date().toISOString(),
      frames,
      jsLag,
      memory: {
        beforeMB: active.beforeBytes / MB,
        afterMB: afterBytes / MB,
        deltaMB: (afterBytes - active.beforeBytes) / MB,
      },
      evaluation: evaluateFrameStats(frames, jsLag),
    };
    await publishResult(result);
    appendResult(result);
    setStatus('Done');
  }, [appendResult, provider, scenario]);

  const selectScenario = useCallback(
    (index: number) => {
      if (running) {
        return;
      }
      setScenarioIndex(index);
      setMapProps(SCENARIOS[index].props());
      setMapKey((key) => key + 1);
    },
    [running],
  );

  const shareResults = useCallback(() => {
    const payload = {
      platform: Platform.OS,
      provider,
      refreshRateHz: refreshRate,
      recordedAt: new Date().toISOString(),
      results,
    };
    Share.share({ message: JSON.stringify(payload, null, 2) }).catch(() => {});
  }, [provider, refreshRate, results]);

  const passed = results.filter((result) => result.evaluation.passed).length;

  // `MapView` props are a discriminated union on `provider`, so each provider
  // gets its own element with a literal prop, as the demo app does.
  const commonMapProps = {
    style: styles.map,
    region: mapProps.region,
    markers: mapProps.markerCollection == null ? mapProps.markers : undefined,
    markerCollection: mapProps.markerCollection,
    polylines: mapProps.polylines,
    polygons: mapProps.polygons,
    clusteringEnabled: mapProps.clusteringEnabled,
    onCameraMove: mapProps.onCameraMove,
    cameraMoveThrottleMs: mapProps.cameraMoveThrottleMs,
    markerEnteringAnimation: false as const,
    clusterEnteringAnimation: false as const,
    onMapReady: handleMapReady,
  };

  return (
    <View style={styles.container}>
      {provider === 'google' ? (
        <MapView
          key={`google:${mapKey}`}
          ref={mapRef}
          provider="google"
          {...commonMapProps}
        />
      ) : (
        <MapView
          key={`apple:${mapKey}`}
          ref={mapRef}
          provider="apple"
          markerRendering={mapProps.markerRendering}
          {...commonMapProps}
        />
      )}

      <View
        style={[styles.panel, { top: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.panelInner}>
          <Text style={styles.title}>
            Benchmark · {Platform.OS} · {provider}
            {refreshRate != null ? ` · ${refreshRate.toFixed(0)} Hz` : ''}
          </Text>
          <Text style={styles.status} testID="benchmark-status">
            {status}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {SCENARIOS.map((item, index) => (
                <Pressable
                  key={item.id}
                  testID={`benchmark-scenario-${item.id}`}
                  onPress={() => selectScenario(index)}
                  style={[
                    styles.chip,
                    index === scenarioIndex && styles.chipActive,
                  ]}
                >
                  <Text style={styles.chipText}>{item.id}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={styles.row}>
            <Pressable
              testID="benchmark-run-all"
              onPress={runAll}
              disabled={running}
              style={[styles.button, running && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>Run all</Text>
            </Pressable>
            <Pressable
              testID="benchmark-run-one"
              onPress={runOne}
              disabled={running}
              style={[styles.button, running && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>
                Run {scenario.id.split('-')[0]}
              </Text>
            </Pressable>
            <Pressable
              testID="benchmark-record-toggle"
              onPress={toggleManualRecording}
              disabled={running}
              style={[styles.button, styles.buttonRecord]}
            >
              <Text style={styles.buttonText}>
                {manualActive ? 'Stop' : 'Record'}
              </Text>
            </Pressable>
            {PROVIDERS.length > 1 ? (
              <Pressable
                testID="benchmark-provider"
                onPress={() =>
                  setProvider((current) =>
                    current === 'apple' ? 'google' : 'apple',
                  )
                }
                disabled={running}
                style={styles.button}
              >
                <Text style={styles.buttonText}>{provider}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.results, { bottom: insets.bottom + 8 }]}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle} testID="benchmark-summary">
            {results.length > 0
              ? `${passed}/${results.length} passed`
              : `${SCENARIOS.length} scenarios · ${SKIPPED_SCENARIOS.length} skipped`}
          </Text>
          <Pressable
            onPress={shareResults}
            disabled={results.length === 0}
            style={styles.link}
          >
            <Text style={styles.linkText}>Share JSON</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.resultsList}>
          {results.map((result) => (
            <Text
              key={`${result.id}-${result.recordedAt}`}
              style={[
                styles.resultLine,
                !result.evaluation.passed && styles.resultFail,
              ]}
              testID={`benchmark-result-${result.id}`}
            >
              {formatResultLine(result)}
              {result.evaluation.failures.length > 0
                ? `\n   ${result.evaluation.failures.join('; ')}`
                : ''}
            </Text>
          ))}
          {results.length === 0 ? (
            <Text style={styles.resultLine}>{scenario.description}</Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0B' },
  map: { flex: 1 },
  panel: { position: 'absolute', left: 8, right: 8 },
  panelInner: {
    backgroundColor: 'rgba(18, 18, 20, 0.92)',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  status: { color: 'rgba(255,255,255,0.72)', fontSize: 12 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(59, 130, 246, 0.45)' },
  chipText: { color: '#FFFFFF', fontSize: 11, fontVariant: ['tabular-nums'] },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.35)',
  },
  buttonRecord: { backgroundColor: 'rgba(255, 59, 48, 0.4)' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  results: {
    position: 'absolute',
    left: 8,
    right: 8,
    maxHeight: 260,
    backgroundColor: 'rgba(18, 18, 20, 0.92)',
    borderRadius: 12,
    padding: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  resultsTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  link: { paddingHorizontal: 4 },
  linkText: { color: '#7EB5DF', fontSize: 12, fontWeight: '600' },
  resultsList: { maxHeight: 220 },
  resultLine: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 15,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  resultFail: { color: '#FFB4AE' },
});
