import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { MapView, MarkerView } from 'react-native-better-maps';
import type { MapViewRef } from 'react-native-better-maps';
import {
  logBenchmarkLine,
  memoryFootprintBytes,
  setBenchmarkKeepAwake,
  startFrameRecording,
  stopFrameRecording,
} from '../modules/frame-stats';

const CENTER = { latitude: 52.2297, longitude: 21.0122 };
const CAMERA = { center: CENTER, zoom: 14, pitch: 0, heading: 0 };
const CAMERA_ANIMATION_SECONDS = 1.2;
type Mode =
  | 'pins'
  | 'live-static'
  | 'live-transform'
  | 'live-layout'
  | 'overlay-transform'
  | 'overlay-layout'
  | 'cluster-pins'
  | 'cluster-static'
  | 'cluster-transform'
  | 'cluster-layout';
const MODES: Mode[] = [
  'pins',
  'live-static',
  'live-transform',
  'live-layout',
  'overlay-transform',
  'overlay-layout',
  'cluster-pins',
  'cluster-static',
  'cluster-transform',
  'cluster-layout',
];
const PRIMARY_MODES: Mode[] = [
  'pins',
  'live-static',
  'live-transform',
  'live-layout',
];
const CONTROL_MODES: Mode[] = [
  'overlay-transform',
  'live-transform',
  'overlay-layout',
  'live-layout',
];
const CLUSTER_MODES: Mode[] = [
  'cluster-pins',
  'cluster-static',
  'cluster-transform',
  'cluster-layout',
];
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function Badge({
  progress,
  mode,
  index,
  clusterCount,
  onClusterPress,
}: {
  progress: SharedValue<number>;
  mode: Mode;
  index: number;
  clusterCount?: number;
  onClusterPress?: () => Promise<void>;
}) {
  const [presses, setPresses] = useState(0);
  const animation = useAnimatedStyle(() => {
    if (mode.endsWith('transform')) {
      return { transform: [{ rotate: `${progress.value * 360}deg` }] };
    }
    if (mode.endsWith('layout')) return { width: 12 + progress.value * 16 };
    return {};
  });
  return (
    <Pressable
      accessibilityLabel={
        clusterCount == null
          ? `Marker ${index}, presses ${presses}`
          : `Cluster ${clusterCount} points`
      }
      onPress={() => {
        if (onClusterPress) void onClusterPress();
        else setPresses((value) => value + 1);
      }}
      style={styles.badge}
    >
      <Animated.View style={[styles.glyph, animation]} />
      <Text style={styles.price}>
        {clusterCount ?? (presses > 0 ? `Tap ${presses}` : `$${100 + index}`)}
      </Text>
    </Pressable>
  );
}

export default function MarkerViewBenchmark() {
  const map = useRef<MapViewRef>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('cluster-transform');
  const [count, setCount] = useState(200);
  const [mapGeneration, setMapGeneration] = useState(0);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [mapPresses, setMapPresses] = useState(0);
  const [mounted, setMounted] = useState(true);
  const progress = useSharedValue(0);
  const active = useRef(true);
  const provider = Platform.OS === 'ios' ? 'apple' : 'google';

  useEffect(() => {
    active.current = true;
    void setBenchmarkKeepAwake(true);
    return () => {
      active.current = false;
      void setBenchmarkKeepAwake(false);
    };
  }, []);
  useEffect(() => {
    if (mode.endsWith('transform') || mode.endsWith('layout')) {
      progress.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [mode, progress]);

  const markers = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: `benchmark-${i}`,
        coordinate: {
          latitude: CENTER.latitude + ((i % 10) - 4.5) * 0.0005,
          longitude:
            CENTER.longitude +
            (Math.floor(i / 10) - Math.floor(count / 20)) *
              0.00065 *
              Math.min(1, 200 / count),
        },
        enteringAnimation: false as const,
      })),
    [count],
  );
  const children = useMemo(
    () =>
      !(
        mode.startsWith('live-') ||
        (mode.startsWith('cluster-') && mode !== 'cluster-pins')
      )
        ? null
        : markers.map((marker, index) => (
            <MarkerView
              key={marker.id}
              id={marker.id}
              coordinate={marker.coordinate}
              width={96}
              height={48}
            >
              <Badge progress={progress} mode={mode} index={index} />
            </MarkerView>
          )),
    [markers, mode, progress],
  );

  async function run(
    kind: 'primary' | 'control' | 'selected' | 'cluster' = 'primary',
  ) {
    if (running) return;
    setRunning(true);
    setMounted(true);
    try {
      // Alternating candidate order on repeated passes limits warmup/order bias.
      const cases =
        kind === 'cluster'
          ? CLUSTER_MODES
          : kind === 'control'
            ? CONTROL_MODES
            : kind === 'selected'
              ? [mode]
              : PRIMARY_MODES;
      const sizes =
        kind === 'cluster'
          ? [200, 1000]
          : kind === 'control'
            ? [200]
            : kind === 'selected'
              ? [count]
              : [10, 50, 200];
      for (let pass = 0; pass < 3 && active.current; pass++) {
        for (const size of sizes) {
          for (const candidate of pass % 2 ? [...cases].reverse() : cases) {
            if (!active.current) return;
            const name = `${pass + 1}/3 ${size} ${candidate}`;
            setStatus(`Warmup ${name}`);
            setCount(size);
            setMode(candidate);
            setMapGeneration((value) => value + 1);
            await sleep(2500);
            if (!active.current || !map.current) return;
            await map.current.setCamera(CAMERA);
            await sleep(1000);
            const beforeBytes = await memoryFootprintBytes();
            const cameraBefore = await map.current.getCamera();
            setStatus(`Recording ${name}`);
            await sleep(100);
            await startFrameRecording(`${candidate}-${size}-pass${pass + 1}`);
            for (let leg = 0; leg < 4; leg++) {
              await map.current?.animateCamera(
                {
                  ...CAMERA,
                  zoom:
                    candidate.startsWith('cluster-') && (leg === 1 || leg === 2)
                      ? 17
                      : 14,
                  center: {
                    latitude: CENTER.latitude + (leg % 2 ? -0.001 : 0.001),
                    longitude: CENTER.longitude,
                  },
                  heading: leg * 12,
                },
                CAMERA_ANIMATION_SECONDS,
              );
              await sleep(1500);
            }
            const recording = await stopFrameRecording();
            const cameraAfter = await map.current.getCamera();
            const cameraRouteCompleted =
              Math.abs(
                cameraAfter.center.latitude - (CENTER.latitude - 0.001),
              ) < 0.00005 &&
              Math.abs(cameraAfter.center.longitude - CENTER.longitude) <
                0.00005 &&
              Math.abs((((cameraAfter.heading ?? 0) - 36 + 540) % 360) - 180) <
                1;
            const afterBytes = await memoryFootprintBytes();
            const row = {
              kind: 'marker-view-benchmark',
              suite: kind,
              workloadVersion: 4,
              clusteringEnabled: candidate.startsWith('cluster-'),
              cameraAnimationSeconds: CAMERA_ANIMATION_SECONDS,
              cameraBefore,
              cameraAfter,
              cameraRouteCompleted,
              provider,
              mode: candidate,
              count: size,
              pass,
              beforeBytes,
              afterBytes,
              ...recording,
            };
            await logBenchmarkLine(
              `[marker-view-benchmark] ${JSON.stringify(row)}`,
            );
            if (!cameraRouteCompleted)
              throw new Error('Camera did not complete the benchmark route');
          }
        }
      }
      setStatus('Complete — raw samples in device log');
      await logBenchmarkLine('[marker-view-benchmark] COMPLETE');
    } catch (error) {
      setStatus(`Failed: ${String(error)}`);
      await logBenchmarkLine(`[marker-view-benchmark] ERROR ${String(error)}`);
    } finally {
      await stopFrameRecording();
      if (active.current) setRunning(false);
    }
  }

  return (
    <View style={styles.root}>
      {mounted && (
        <MapView
          key={mapGeneration}
          ref={map}
          provider={provider}
          style={styles.map}
          camera={CAMERA}
          markerEnteringAnimation={false}
          clusterEnteringAnimation={false}
          markers={
            mode === 'pins' || mode === 'cluster-pins' ? markers : undefined
          }
          clusteringEnabled={mode.startsWith('cluster-')}
          renderCluster={
            mode.startsWith('cluster-') && mode !== 'cluster-pins'
              ? (cluster) => (
                  <MarkerView
                    coordinate={cluster.coordinate}
                    width={96}
                    height={48}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <Badge
                      progress={progress}
                      mode={mode}
                      index={0}
                      clusterCount={cluster.count}
                      onClusterPress={cluster.onPress}
                    />
                  </MarkerView>
                )
              : undefined
          }
          onPress={() => setMapPresses((value) => value + 1)}
        >
          {children}
        </MapView>
      )}
      {mounted && mode.startsWith('overlay-') && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {markers.map((marker, index) => (
            <View
              key={marker.id}
              style={{
                position: 'absolute',
                width: 96,
                height: 48,
                left:
                  screenWidth / 2 +
                  (Math.floor(index / 10) - Math.floor(count / 20)) * 16 -
                  48,
                top: screenHeight / 2 - ((index % 10) - 4.5) * 29.5 - 48,
              }}
            >
              <Badge progress={progress} mode={mode} index={index} />
            </View>
          ))}
        </View>
      )}
      <View style={styles.panel}>
        <Text>{status}</Text>
        <Text>
          {mode}, {count} points, map presses {mapPresses}
        </Text>
        <View style={styles.buttons}>
          <Pressable
            accessibilityLabel="Run marker benchmark"
            disabled={running}
            onPress={() => {
              void run();
            }}
            style={styles.button}
          >
            <Text>Run A/B</Text>
          </Pressable>
          <Pressable
            disabled={running}
            onPress={() =>
              setCount((value) => (value === 10 ? 50 : value === 50 ? 200 : 10))
            }
            style={styles.button}
          >
            <Text>Count</Text>
          </Pressable>
          <Pressable
            disabled={running}
            onPress={() =>
              setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length])
            }
            style={styles.button}
          >
            <Text>Mode</Text>
          </Pressable>
          <Pressable
            disabled={running}
            onPress={() => setMounted((value) => !value)}
            style={styles.button}
          >
            <Text>Mount</Text>
          </Pressable>
        </View>
        <View style={styles.buttons}>
          <Pressable
            disabled={running}
            onPress={() => {
              void run('control');
            }}
            style={styles.button}
          >
            <Text>JSX control A/B</Text>
          </Pressable>
          <Pressable
            disabled={running}
            onPress={() => {
              void run('selected');
            }}
            style={styles.button}
          >
            <Text>Run selected</Text>
          </Pressable>
          <Pressable
            disabled={running}
            onPress={() => {
              void run('cluster');
            }}
            style={styles.button}
          >
            <Text>Clusters</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 36,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 10 },
  button: { padding: 10, backgroundColor: '#e0e7ff', borderRadius: 8 },
  badge: {
    width: 96,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#4f46e5',
  },
  glyph: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#4f46e5' },
  price: { fontSize: 14, fontWeight: '600', color: '#111827' },
});
