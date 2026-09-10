import type { Camera, Coordinate } from 'react-native-better-maps';
import { cameraAt } from '../fixtures/regions';
import type { ScenarioContext } from './types';

export interface PanOptions {
  legs?: number;
  stepDegrees?: number;
  legMs?: number;
  zoom?: number;
  settleMs?: number;
}

const SQUARE_OFFSETS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/** Pans the camera in a square around `center`, one animated leg at a time. */
export async function pan(
  context: ScenarioContext,
  center: Coordinate,
  options: PanOptions = {},
): Promise<void> {
  const {
    legs = 6,
    stepDegrees = 0.03,
    legMs = 600,
    zoom = 12,
    settleMs,
  } = options;
  for (let leg = 0; leg < legs; leg += 1) {
    const [dy, dx] = SQUARE_OFFSETS[leg % SQUARE_OFFSETS.length];
    await context.animateCamera(
      cameraAt(
        {
          latitude: center.latitude + dy * stepDegrees * (1 + leg * 0.3),
          longitude: center.longitude + dx * stepDegrees * (1 + leg * 0.3),
        },
        { zoom },
      ),
      legMs,
      settleMs,
    );
  }
  await context.animateCamera(cameraAt(center, { zoom }), legMs, settleMs);
}

/** Back-to-back short legs with no settle, so the map never comes to rest. */
export async function continuousPan(
  context: ScenarioContext,
  center: Coordinate,
  options: {
    durationMs?: number;
    legMs?: number;
    stepDegrees?: number;
    zoom?: number;
  } = {},
): Promise<void> {
  const {
    durationMs = 6000,
    legMs = 400,
    stepDegrees = 0.015,
    zoom = 12,
  } = options;
  const started = Date.now();
  let leg = 0;
  while (Date.now() - started < durationMs) {
    const angle = leg * 0.9;
    await context.animateCamera(
      cameraAt(
        {
          latitude: center.latitude + Math.sin(angle) * stepDegrees * 2,
          longitude: center.longitude + Math.cos(angle) * stepDegrees * 3,
        },
        { zoom },
      ),
      legMs,
      0,
    );
    leg += 1;
  }
}

/** Zooms through several levels so clustering and LOD re-form at each. */
export async function zoomSweep(
  context: ScenarioContext,
  center: Coordinate,
  zooms: number[],
  legMs = 900,
  settleMs?: number,
): Promise<void> {
  for (const zoom of zooms) {
    await context.animateCamera(cameraAt(center, { zoom }), legMs, settleMs);
  }
}

export async function rotate(
  context: ScenarioContext,
  center: Coordinate,
  headings: number[],
  legMs = 700,
  zoom = 12,
): Promise<void> {
  for (const heading of headings) {
    await context.animateCamera(cameraAt(center, { zoom, heading }), legMs);
  }
}

export async function pitch(
  context: ScenarioContext,
  center: Coordinate,
  pitches: number[],
  legMs = 700,
  zoom = 14,
): Promise<void> {
  for (const value of pitches) {
    await context.animateCamera(
      cameraAt(center, { zoom, pitch: value }),
      legMs,
    );
  }
}

/** Many very short moves in quick succession (a user flicking the map). */
export async function rapidMoves(
  context: ScenarioContext,
  center: Coordinate,
  count = 20,
  legMs = 150,
  zoom = 12,
): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.4;
    const camera: Camera = cameraAt(
      {
        latitude: center.latitude + Math.sin(angle) * 0.01,
        longitude: center.longitude + Math.cos(angle) * 0.015,
      },
      { zoom: zoom + (index % 3) * 0.5 },
    );
    await context.animateCamera(camera, legMs, 20);
  }
  await context.animateCamera(cameraAt(center, { zoom }), 300);
}

export function countLabel(count: number): string {
  if (count >= 1000) {
    return `${count / 1000}k`;
  }
  return String(count);
}
