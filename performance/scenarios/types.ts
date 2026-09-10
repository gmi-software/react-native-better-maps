import type {
  Camera,
  MapViewProps,
  MapViewRef,
  MarkerDescriptor,
  Region,
} from 'react-native-better-maps';

export type PolylineDescriptor = NonNullable<MapViewProps['polylines']>[number];
export type PolygonDescriptor = NonNullable<MapViewProps['polygons']>[number];
export type CircleDescriptor = NonNullable<MapViewProps['circles']>[number];

/** The subset of `MapView` props a scenario controls. */
export interface PerfMapProps {
  region: Region;
  /** Bulk `markers` prop (the recommended path for large sets). */
  markers?: MarkerDescriptor[];
  /** Rendered as `<Marker>` children instead of the bulk prop. */
  markerChildren?: MarkerDescriptor[];
  polylines?: PolylineDescriptor[];
  polygons?: PolygonDescriptor[];
  circles?: CircleDescriptor[];
  clusteringEnabled?: boolean;
  markerEnteringAnimation?: MapViewProps['markerEnteringAnimation'];
}

export type ScenarioGroup =
  | 'markers'
  | 'camera'
  | 'mutations'
  | 'geometry'
  | 'clustering'
  | 'combined'
  | 'stability';

/**
 * `baseline`: part of `bun perf baseline`. `quick`: the short smoke suite.
 * `gesture`: needs an external driver for real touch input (the CLI does it
 * on Android with adb). `heavy`: very large datasets, opt in. `long`: runs
 * for minutes.
 */
export type ScenarioTag = 'baseline' | 'quick' | 'gesture' | 'heavy' | 'long';

export interface CommitSample {
  label: string;
  /**
   * JS-thread time from the state update to the layout effect after commit:
   * React render, Fabric shadow-tree commit and Nitro prop parsing (the JSI
   * object → C++ struct conversion runs on the JS thread inside this window).
   */
  commitMs: number;
  /** `performance.now()` when the layout effect ran. */
  committedAt: number;
}

export type StepMeta = Record<string, number | string>;

/** What a scenario script can do while the recorders are running. */
export interface ScenarioContext {
  readonly platform: 'ios' | 'android';
  readonly refreshRateHz: number;
  map(): MapViewRef | null;
  /** Applies new props to the mounted map and resolves after the React commit. */
  setProps(patch: Partial<PerfMapProps>, label?: string): Promise<CommitSample>;
  sleep(ms: number): Promise<void>;
  /** Animates the camera and waits for the animation plus a short settle. */
  animateCamera(
    camera: Camera,
    durationMs: number,
    settleMs?: number,
  ): Promise<void>;
  setCamera(camera: Camera): Promise<void>;
  /**
   * Groups work under a named step. Commits, native spans and JS allocations
   * that happen inside are attributed to the step in the result.
   */
  step(label: string, run: () => Promise<void>, meta?: StepMeta): Promise<void>;
  /**
   * Closes the current timeline window (frame stats, memory, CPU) and opens a
   * new one; long-running scenarios call this periodically.
   */
  checkpoint(label: string): Promise<void>;
  /**
   * Announces a window during which an external driver performs real
   * gestures (the CLI drives `adb shell input swipe`), then waits for it.
   */
  gestureWindow(name: string, durationMs: number): Promise<void>;
  /** Records a custom scalar metric on the result. */
  metric(name: string, value: number): void;
  note(text: string): void;
}

export interface Scenario {
  id: string;
  name: string;
  group: ScenarioGroup;
  description: string;
  tags: ScenarioTag[];
  /** Initial map props; lazy so fixtures are generated only when the scenario runs. */
  props(): PerfMapProps;
  /** Extra settle time after `onMapReady` before recording starts. */
  settleMs?: number;
  estimatedDurationMs: number;
  run(context: ScenarioContext): Promise<void>;
}
