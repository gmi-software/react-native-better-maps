import type { Coordinate, MarkerDescriptor } from 'react-native-better-maps';
import { Random, round } from './prng';
import { DEFAULT_SEED } from './markers';
import type { PolylineDescriptor } from './polylines';

/**
 * Deterministic marker mutations. Every function returns a new array and new
 * objects only for the markers it changed, which is how an app would update
 * state immutably (and what React / Fabric prop diffing then has to walk).
 */

export function pickIndices(
  total: number,
  count: number,
  seed = DEFAULT_SEED,
): number[] {
  return new Random(seed ^ (total * 7 + count)).indices(total, count);
}

function shifted(
  coordinate: Coordinate,
  tick: number,
  index: number,
): Coordinate {
  const angle = tick * 0.35 + index * 0.01;
  return {
    latitude: round(coordinate.latitude + Math.sin(angle) * 0.0006),
    longitude: round(coordinate.longitude + Math.cos(angle) * 0.0009),
  };
}

/** Moves the markers at `indices` by a small deterministic step. */
export function moveMarkers(
  markers: MarkerDescriptor[],
  indices: readonly number[],
  tick: number,
): MarkerDescriptor[] {
  if (indices.length === 0) {
    return markers;
  }
  const next = markers.slice();
  for (const index of indices) {
    const marker = markers[index];
    next[index] = {
      ...marker,
      coordinate: shifted(marker.coordinate, tick, index),
    };
  }
  return next;
}

/** Moves the first `count` markers (the animated-marker workload). */
export function moveFirstMarkers(
  markers: MarkerDescriptor[],
  count: number,
  tick: number,
): MarkerDescriptor[] {
  const indices: number[] = [];
  for (let index = 0; index < Math.min(count, markers.length); index += 1) {
    indices.push(index);
  }
  return moveMarkers(markers, indices, tick);
}

/** Moves a deterministic `fraction` (0..1) of the markers. */
export function moveMarkerFraction(
  markers: MarkerDescriptor[],
  fraction: number,
  tick: number,
  seed = DEFAULT_SEED,
): MarkerDescriptor[] {
  const count = Math.max(1, Math.round(markers.length * fraction));
  return moveMarkers(
    markers,
    pickIndices(markers.length, count, seed + tick),
    tick,
  );
}

export function appendMarker(
  markers: MarkerDescriptor[],
  tick: number,
): MarkerDescriptor[] {
  const last = markers[markers.length - 1];
  return [
    ...markers,
    {
      id: `m-added-${tick}`,
      coordinate: shifted(last.coordinate, tick, markers.length),
    },
  ];
}

export function removeLastMarker(
  markers: MarkerDescriptor[],
): MarkerDescriptor[] {
  return markers.slice(0, -1);
}

/** Recolors a polyline without touching its geometry. */
export function restylePolyline(
  polyline: PolylineDescriptor,
  tick: number,
): PolylineDescriptor {
  const colors = [
    '#FF9500',
    '#34C759',
    '#AF52DE',
    '#FF2D55',
    '#FF3B30',
    '#007AFF',
  ];
  return {
    ...polyline,
    strokeColor: colors[tick % colors.length],
    strokeWidth: 3 + (tick % 3),
  };
}

/** Moves every `stride`-th point of a polyline slightly (a "live route" update). */
export function perturbPolyline(
  polyline: PolylineDescriptor,
  tick: number,
  stride = 10,
): PolylineDescriptor {
  const coordinates = polyline.coordinates.slice();
  for (let index = 0; index < coordinates.length; index += stride) {
    coordinates[index] = shifted(coordinates[index], tick, index);
  }
  return { ...polyline, coordinates };
}
