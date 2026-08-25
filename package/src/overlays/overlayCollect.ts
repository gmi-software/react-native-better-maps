import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import type { MarkerProps } from '../types/overlays';

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
}

export function resolveOverlayId(
  providedId: string | undefined,
  type: string,
  index: number,
): string {
  if (providedId != null && providedId.length > 0) {
    return providedId;
  }

  return `${type}-${index}`;
}

export function tappableFromPress(
  onPress: unknown,
  tappable: boolean | undefined,
): boolean | undefined {
  return onPress != null ? (tappable ?? true) : tappable;
}
