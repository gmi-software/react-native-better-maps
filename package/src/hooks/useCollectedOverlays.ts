import { useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import { collectOverlayChildren } from '../overlays/collectOverlayChildren';
import { resolveMarkerImage } from '../overlays/resolveMarkerImage';
import type {
  OverlayCallbacks,
  OverlayCollectorState,
} from '../overlays/overlayCollect';

export interface CollectedOverlays {
  markers: MarkerDescriptor[];
  polylines: PolylineDescriptor[];
  polygons: PolygonDescriptor[];
  circles: CircleDescriptor[];
  callbackRegistry: MutableRefObject<Map<string, OverlayCallbacks>>;
  hasMarkerPress: boolean;
  hasMarkerDragEnd: boolean;
  hasPolylinePress: boolean;
  hasPolygonPress: boolean;
  hasCirclePress: boolean;
}

export function useCollectedOverlays(children: ReactNode): CollectedOverlays {
  const callbackRegistry = useRef(new Map<string, OverlayCallbacks>());

  const overlays = useMemo(() => {
    const state: OverlayCollectorState = {
      registry: new Map<string, OverlayCallbacks>(),
      markers: [],
      polylines: [],
      polygons: [],
      circles: [],
      markerIndex: 0,
      polylineIndex: 0,
      polygonIndex: 0,
      circleIndex: 0,
      geojsonIndex: 0,
      hasMarkerPress: false,
      hasMarkerDragEnd: false,
      hasPolylinePress: false,
      hasPolygonPress: false,
      hasCirclePress: false,
    };

    collectOverlayChildren(children, state, { resolveMarkerImage });

    callbackRegistry.current = state.registry;

    return {
      markers: state.markers,
      polylines: state.polylines,
      polygons: state.polygons,
      circles: state.circles,
      hasMarkerPress: state.hasMarkerPress,
      hasMarkerDragEnd: state.hasMarkerDragEnd,
      hasPolylinePress: state.hasPolylinePress,
      hasPolygonPress: state.hasPolygonPress,
      hasCirclePress: state.hasCirclePress,
    };
  }, [children]);

  return {
    ...overlays,
    callbackRegistry,
  };
}
