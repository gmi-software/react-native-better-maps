import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import type { MarkerProps } from '../types/overlays';
import { createOverlayIdState, type OverlayIdState } from './overlayIds';

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
  ids: OverlayIdState;
  hasMarkerPress: boolean;
  hasMarkerDragEnd: boolean;
  hasPolylinePress: boolean;
  hasPolygonPress: boolean;
  hasCirclePress: boolean;
}

export function createOverlayCollectorState(): OverlayCollectorState {
  return {
    registry: new Map(),
    markers: [],
    polylines: [],
    polygons: [],
    circles: [],
    ids: createOverlayIdState(),
    hasMarkerPress: false,
    hasMarkerDragEnd: false,
    hasPolylinePress: false,
    hasPolygonPress: false,
    hasCirclePress: false,
  };
}

export function tappableFromPress(
  onPress: unknown,
  tappable: boolean | undefined,
): boolean | undefined {
  return onPress != null ? (tappable ?? true) : (tappable ?? undefined);
}
