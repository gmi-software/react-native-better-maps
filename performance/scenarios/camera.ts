import { WARSAW_CENTER, WARSAW_REGION } from '../fixtures/regions';
import { markers } from '../fixtures';
import {
  continuousPan,
  countLabel,
  pan,
  pitch,
  rapidMoves,
  rotate,
  zoomSweep,
} from './helpers';
import type { Scenario, ScenarioContext, ScenarioTag } from './types';

export type CameraKind =
  | 'idle'
  | 'slow-pan'
  | 'fast-pan'
  | 'continuous-pan'
  | 'zoom-in'
  | 'zoom-out'
  | 'rapid-zoom'
  | 'rotate'
  | 'pitch'
  | 'rapid';

interface CameraKindDefinition {
  description: string;
  estimatedDurationMs: number;
  run(context: ScenarioContext): Promise<void>;
}

export const CAMERA_KINDS: Record<CameraKind, CameraKindDefinition> = {
  idle: {
    description:
      'No camera movement for 5 s; measures the resting cost of the scene.',
    estimatedDurationMs: 5000,
    run: (context) => context.sleep(5000),
  },
  'slow-pan': {
    description: 'Four slow animated pan legs (1.2 s each, small steps).',
    estimatedDurationMs: 7000,
    run: (context) =>
      pan(context, WARSAW_CENTER, { legs: 4, legMs: 1200, stepDegrees: 0.02 }),
  },
  'fast-pan': {
    description: 'Six fast animated pan legs (400 ms each, larger steps).',
    estimatedDurationMs: 5000,
    run: (context) =>
      pan(context, WARSAW_CENTER, { legs: 6, legMs: 400, stepDegrees: 0.04 }),
  },
  'continuous-pan': {
    description:
      'Six seconds of back-to-back pan legs with no settle between them.',
    estimatedDurationMs: 7000,
    run: (context) =>
      continuousPan(context, WARSAW_CENTER, { durationMs: 6000 }),
  },
  'zoom-in': {
    description: 'Zoom from country scale into street scale in four steps.',
    estimatedDurationMs: 5000,
    run: (context) =>
      zoomSweep(context, WARSAW_CENTER, [8, 10, 12, 14, 16], 800),
  },
  'zoom-out': {
    description: 'Zoom from street scale out to country scale in four steps.',
    estimatedDurationMs: 5000,
    run: (context) =>
      zoomSweep(context, WARSAW_CENTER, [16, 14, 12, 10, 8], 800),
  },
  'rapid-zoom': {
    description:
      'Ten alternating zoom jumps of 300 ms each across three octaves.',
    estimatedDurationMs: 5000,
    run: (context) =>
      zoomSweep(
        context,
        WARSAW_CENTER,
        [10, 13, 10, 13, 11, 14, 10, 13, 12, 12],
        300,
        60,
      ),
  },
  rotate: {
    description: 'Four heading changes of 90° at city zoom.',
    estimatedDurationMs: 4000,
    run: (context) => rotate(context, WARSAW_CENTER, [90, 180, 270, 0], 700),
  },
  pitch: {
    description: 'Pitch to 45°, 60°, back to 0° at street zoom.',
    estimatedDurationMs: 4000,
    run: (context) => pitch(context, WARSAW_CENTER, [45, 60, 0], 700),
  },
  rapid: {
    description: 'Twenty 150 ms flicks mixing small pans and half-zoom steps.',
    estimatedDurationMs: 5000,
    run: (context) => rapidMoves(context, WARSAW_CENTER, 20, 150),
  },
};

export const CAMERA_MARKER_COUNTS = [0, 1000, 10_000, 50_000] as const;

function tagsFor(kind: CameraKind, count: number): ScenarioTag[] {
  const tags: ScenarioTag[] = [];
  if (count === 10_000 || (kind === 'fast-pan' && count !== 10_000)) {
    tags.push('baseline');
  }
  if (kind === 'fast-pan' && count === 10_000) {
    tags.push('quick');
  }
  if (count === 50_000) {
    tags.push('heavy');
  }
  return tags;
}

export function cameraScenario(
  kind: CameraKind,
  markerCount: number,
): Scenario {
  const definition = CAMERA_KINDS[kind];
  const label = countLabel(markerCount);
  return {
    id: `camera-${kind}-${label}`,
    name: `Camera ${kind}, ${label} markers`,
    group: 'camera',
    description: `${definition.description} Scene: ${markerCount} markers.`,
    tags: tagsFor(kind, markerCount),
    props: () => ({
      region: WARSAW_REGION,
      markers: markerCount > 0 ? markers(markerCount) : undefined,
    }),
    settleMs:
      markerCount >= 50_000 ? 4000 : markerCount >= 10_000 ? 2500 : 1200,
    estimatedDurationMs: definition.estimatedDurationMs + 3000,
    run: definition.run,
  };
}

export const CAMERA_SCENARIOS: Scenario[] = [
  ...CAMERA_MARKER_COUNTS.flatMap((count) =>
    (Object.keys(CAMERA_KINDS) as CameraKind[]).map((kind) =>
      cameraScenario(kind, count),
    ),
  ),
  {
    id: 'camera-gesture-pan-10k',
    name: 'Real gesture pan, 10k markers',
    group: 'camera',
    description:
      'Records for 8 s while an external driver performs touch swipes (the CLI does this on Android with adb; on iOS use Maestro or a finger).',
    tags: ['gesture'],
    props: () => ({ region: WARSAW_REGION, markers: markers(10_000) }),
    settleMs: 2500,
    estimatedDurationMs: 11_000,
    run: (context) => context.gestureWindow('pan', 8000),
  },
  {
    id: 'camera-gesture-zoom-10k',
    name: 'Real gesture zoom, 10k markers',
    group: 'camera',
    description:
      'Records for 8 s while an external driver performs pinch gestures (Android: adb multi-touch swipes).',
    tags: ['gesture'],
    props: () => ({ region: WARSAW_REGION, markers: markers(10_000) }),
    settleMs: 2500,
    estimatedDurationMs: 11_000,
    run: (context) => context.gestureWindow('zoom', 8000),
  },
];
