import { useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import type {
  CircleDescriptor,
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import { collectOverlayChildren } from '../overlays/collectOverlayChild';
import {
  createPositionalIdTracker,
  trackPositionalIds,
} from '../overlays/overlayIds';
import { resolveMarkerImage } from '../overlays/resolveMarkerImage';
import type { OverlayCallbacks } from '../overlays/overlayCollect';

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
  const positionalIds = useRef(createPositionalIdTracker());

  const overlays = useMemo(() => {
    const state = collectOverlayChildren(children, { resolveMarkerImage });

    callbackRegistry.current = state.registry;
    trackPositionalIds(positionalIds.current, state.ids.anonymous);

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
