import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import type { ReactElement } from 'react';
import type { MarkerViewProps } from '../types/markerView';
import type { MarkerProps } from '../types/overlays';
import { createOverlayIdState, type OverlayIdState } from './overlayIds';

export interface OverlayCallbacks {
  onPress?: () => void;
  onDragEnd?: (coordinate: MarkerProps['coordinate']) => void;
}

/** A `MarkerView` child: its JSX, mounted while the map shows it, and what the pipeline places. */
export interface CollectedMarkerView {
  id: string;
  element: ReactElement<MarkerViewProps>;
  descriptor: MarkerDescriptor;
}

export interface OverlayCollectorState {
  registry: Map<string, OverlayCallbacks>;
  markers: MarkerDescriptor[];
  markerViews: CollectedMarkerView[];
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
    markerViews: [],
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
