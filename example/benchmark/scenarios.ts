import type {
  Camera,
  MapViewRef,
  MarkerDescriptor,
  Region,
} from 'react-native-better-maps';
import {
  POLAND_REGION,
  WARSAW_REGION,
  longRoute,
  markers,
  polygonGrid,
  stepMarkers,
  type PolygonDescriptor,
  type PolylineDescriptor,
} from './datasets';

/** The subset of `MapView` props a scenario controls. */
export interface BenchmarkMapProps {
  region: Region;
  markers?: MarkerDescriptor[];
  polylines?: PolylineDescriptor[];
  polygons?: PolygonDescriptor[];
  clusteringEnabled?: boolean;
}

/** What a scenario script can do while the recorder is running. */
export interface ScenarioContext {
  map(): MapViewRef | null;
  /** Applies new props to the mounted map and waits for the commit. */
  setProps(patch: Partial<BenchmarkMapProps>): Promise<void>;
  sleep(ms: number): Promise<void>;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  props: BenchmarkMapProps;
  /** Extra settle time after `onMapReady` before recording starts. */
  settleMs?: number;
  /** Also fail the scenario when the JS thread cannot keep up with the frame budget. */
  checkJsLag?: boolean;
  run(context: ScenarioContext): Promise<void>;
}

function cameraAt(region: Region, overrides: Partial<Camera> = {}): Camera {
  return {
    center: { latitude: region.latitude, longitude: region.longitude },
    zoom: 12,
    heading: 0,
    pitch: 0,
    ...overrides,
  };
}

async function animate(
  context: ScenarioContext,
  camera: Camera,
  durationMs: number,
): Promise<void> {
  await context.map()?.animateCamera(camera, durationMs / 1000);
  await context.sleep(durationMs + 120);
}

/** Pans the camera in a square around `region`, one animated leg at a time. */
export async function pan(
  context: ScenarioContext,
  region: Region,
  legs = 6,
  stepDegrees = 0.03,
  legMs = 600,
): Promise<void> {
  const offsets = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  for (let leg = 0; leg < legs; leg += 1) {
    const [dy, dx] = offsets[leg % offsets.length];
    await animate(
      context,
      cameraAt(region, {
        center: {
          latitude: region.latitude + dy * stepDegrees * (1 + leg * 0.3),
          longitude: region.longitude + dx * stepDegrees * (1 + leg * 0.3),
        },
      }),
      legMs,
    );
  }
  await animate(context, cameraAt(region), legMs);
}

/** Zooms through several octaves so clustering re-forms at each level. */
export async function zoomSweep(
  context: ScenarioContext,
  region: Region,
  zooms = [9, 13, 7, 11, 6],
  legMs = 900,
): Promise<void> {
  for (const zoom of zooms) {
    await animate(context, cameraAt(region, { zoom }), legMs);
  }
}

export async function rotate(
  context: ScenarioContext,
  region: Region,
  headings = [90, 180, 270, 0],
  legMs = 700,
): Promise<void> {
  for (const heading of headings) {
    await animate(context, cameraAt(region, { heading }), legMs);
  }
}

export const SCENARIOS: BenchmarkScenario[] = [
  {
    id: 'A-empty-idle',
    name: 'A · Empty map',
    description: 'No overlays. 3 s idle, then a short pan.',
    props: { region: WARSAW_REGION },
    async run(context) {
      await context.sleep(3000);
      await pan(context, WARSAW_REGION, 3);
    },
  },
  {
    id: 'B-markers-100',
    name: 'B · 100 markers',
    description: 'Pan with 100 markers.',
    props: { region: WARSAW_REGION, markers: markers(100) },
    run: (context) => pan(context, WARSAW_REGION),
  },
  {
    id: 'C-markers-1k',
    name: 'C · 1,000 markers',
    description: 'Pan with 1,000 markers (viewport pipeline, no clustering).',
    props: { region: WARSAW_REGION, markers: markers(1_000) },
    run: (context) => pan(context, WARSAW_REGION),
  },
  {
    id: 'D-markers-10k',
    name: 'D · 10,000 markers',
    description: 'Pan with 10,000 markers (viewport LOD, no clustering).',
    props: { region: WARSAW_REGION, markers: markers(10_000) },
    settleMs: 2500,
    run: (context) => pan(context, WARSAW_REGION),
  },
  {
    id: 'E-clustered-10k',
    name: 'E · 10,000 clustered',
    description: 'Zoom sweep across octaves, then a pan, with clustering on.',
    props: {
      region: POLAND_REGION,
      markers: markers(10_000),
      clusteringEnabled: true,
    },
    settleMs: 2500,
    async run(context) {
      await zoomSweep(context, POLAND_REGION);
      await pan(context, POLAND_REGION, 4, 0.4);
    },
  },
  {
    id: 'F-pan-10k',
    name: 'F · Long pan',
    description: 'Ten animated pan legs with 10,000 markers.',
    props: { region: WARSAW_REGION, markers: markers(10_000) },
    settleMs: 2500,
    run: (context) => pan(context, WARSAW_REGION, 10, 0.02, 500),
  },
  {
    id: 'G-zoom-10k',
    name: 'G · Zoom sweep',
    description: 'Zoom across five levels with 10,000 markers.',
    props: { region: WARSAW_REGION, markers: markers(10_000) },
    settleMs: 2500,
    run: (context) => zoomSweep(context, WARSAW_REGION),
  },
  {
    id: 'H-rotate-10k',
    name: 'H · Rotation',
    description: 'Four heading changes with 10,000 markers.',
    props: { region: WARSAW_REGION, markers: markers(10_000) },
    settleMs: 2500,
    run: (context) => rotate(context, WARSAW_REGION),
  },
  {
    id: 'I-animated-markers',
    name: 'I · Animated markers',
    description:
      '100 of 1,000 markers move at 10 Hz for 5 s through prop updates.',
    props: { region: WARSAW_REGION, markers: markers(1_000) },
    checkJsLag: true,
    async run(context) {
      let current = markers(1_000);
      for (let tick = 1; tick <= 50; tick += 1) {
        current = stepMarkers(current, 100, tick);
        await context.setProps({ markers: current });
        await context.sleep(100);
      }
    },
  },
  {
    id: 'K-shapes',
    name: 'K · Polylines and polygons',
    description:
      'A 5,000-point route and 200 polygons; five style changes, then a pan.',
    props: {
      region: WARSAW_REGION,
      polylines: [longRoute()],
      polygons: polygonGrid(),
    },
    async run(context) {
      const colors = ['#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#FF3B30'];
      for (const color of colors) {
        await context.setProps({ polylines: [longRoute(5_000, color)] });
        await context.sleep(400);
      }
      await pan(context, WARSAW_REGION, 4);
    },
  },
  {
    id: 'L-idle-after-pan',
    name: 'L · Idle after a pan',
    description: 'Three pan legs with 10,000 markers, then 5 s of nothing.',
    props: { region: WARSAW_REGION, markers: markers(10_000) },
    settleMs: 2500,
    async run(context) {
      await pan(context, WARSAW_REGION, 3);
      await context.sleep(5000);
    },
  },
];

export const SKIPPED_SCENARIOS = [
  'J · Live location: needs location permission and a scripted GPS feed; run manually with the simulator location menu.',
];
