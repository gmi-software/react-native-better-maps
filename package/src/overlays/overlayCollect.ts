import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import type { MarkerProps } from '../types/overlays';
import { warnOverlay } from './warnOverlay';

export interface OverlayCallbacks {
  onPress?: () => void;
  onDragEnd?: (coordinate: MarkerProps['coordinate']) => void;
}

export interface OverlayCollectorState {
  registry: Map<string, OverlayCallbacks>;
  markers: MarkerDescriptor[];
  polylines: PolylineDescriptor[];
  polygons: PolygonDescriptor[];
  circles: CircleDescriptor[];
  markerIndex: number;
  polylineIndex: number;
  polygonIndex: number;
  circleIndex: number;
  geojsonIndex: number;
  hasMarkerPress: boolean;
  hasMarkerDragEnd: boolean;
  hasPolylinePress: boolean;
  hasPolygonPress: boolean;
  hasCirclePress: boolean;
  /** Per-kind ids already assigned in this collection. */
  seenIdsByType?: Map<string, Set<string>>;
}

/** React `key` as exposed on a collected overlay element. */
export type OverlayChildKey = string | number | null | undefined;

export function normalizeOverlayChildKey(key: OverlayChildKey): string | null {
  if (key == null) {
    return null;
  }

  const normalized = String(key);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Public overlay id used by native views and press callbacks
 * (`onMarkerPress`, `onPolylinePress`, `onPolygonPress`, `onCirclePress`,
 * `onClusterPress`).
 *
 * Precedence:
 * 1. explicit `id` when it is a non-empty string
 * 2. `${type}-key-${key}` from the React `key` (`marker-key-b`, `polyline-key-route`)
 * 3. positional `${type}-${index}` last resort (`marker-0`)
 *
 * Positional ids shift when earlier siblings are added or removed and were
 * never a reliable public API.
 */
export function resolveOverlayId(
  providedId: string | undefined,
  key: OverlayChildKey,
  type: string,
  index: number,
): string {
  if (providedId != null && providedId.length > 0) {
    return providedId;
  }

  const normalizedKey = normalizeOverlayChildKey(key);
  if (normalizedKey != null) {
    return `${type}-key-${normalizedKey}`;
  }

  const positionalId = `${type}-${index}`;
  warnOverlay(
    `${type} has no id or React key; using positional id "${positionalId}". Positional ids shift when siblings are added or removed and are not a stable public API.`,
  );
  return positionalId;
}

/**
 * Ensures two overlays of the same kind do not share an id. Collisions are
 * reported in `__DEV__` and the later overlay gets a `#N` suffix.
 */
export function claimOverlayId(
  state: OverlayCollectorState,
  type: string,
  id: string,
): string {
  state.seenIdsByType ??= new Map();
  let seen = state.seenIdsByType.get(type);
  if (seen == null) {
    seen = new Set();
    state.seenIdsByType.set(type, seen);
  }

  if (!seen.has(id)) {
    seen.add(id);
    return id;
  }

  let suffix = 2;
  let candidate = `${id}#${suffix}`;
  while (seen.has(candidate)) {
    suffix += 1;
    candidate = `${id}#${suffix}`;
  }

  warnOverlay(
    `${type} id "${id}" is used by more than one ${type}; using "${candidate}" so both overlays stay addressable`,
  );
  seen.add(candidate);
  return candidate;
}

export function assignOverlayId(
  state: OverlayCollectorState,
  providedId: string | undefined,
  key: OverlayChildKey,
  type: string,
  index: number,
): string {
  return claimOverlayId(
    state,
    type,
    resolveOverlayId(providedId, key, type, index),
  );
}

export function tappableFromPress(
  onPress: unknown,
  tappable: boolean | undefined,
): boolean | undefined {
  return onPress != null ? (tappable ?? true) : tappable;
}
