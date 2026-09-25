import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import type { GeojsonProps } from '../types/geojson';
import type {
  CircleProps,
  MarkerProps,
  PolygonProps,
  PolylineProps,
} from '../types/overlays';
import { Circle } from '../components/Circle';
import { Geojson } from '../components/Geojson';
import { Marker } from '../components/Marker';
import { Polygon } from '../components/Polygon';
import { Polyline } from '../components/Polyline';
import { collectGeojsonOverlays } from './collectGeojsonOverlays';
import {
  createOverlayCollectorState,
  tappableFromPress,
  type OverlayCollectorState,
} from './overlayCollect';
import {
  claimOverlayId,
  reserveOverlayId,
  type OverlayIdKind,
} from './overlayIds';
import type { OverlayComponentType, OverlayTypeName } from './overlayType';
import { OverlayType, overlayCallbackKey } from './overlayType';
import {
  isValidCoordinate,
  isValidCoordinateList,
  isValidRadius,
} from '../utils/validateGeometry';
import { warnOverlay } from './warnOverlay';
import {
  collectMarkerOverlay,
  type MarkerImageResolver,
} from './collectMarkerOverlay';

function isOverlayChild(
  child: ReactElement,
  overlayType: OverlayTypeName,
  component: unknown,
): boolean {
  if (typeof child.type === 'function' || typeof child.type === 'object') {
    const childType = child.type as OverlayComponentType;
    if (childType.overlayType === overlayType) {
      return true;
    }
  }

  return child.type === component;
}

export interface OverlayCollectorDependencies {
  resolveMarkerImage: MarkerImageResolver;
}

interface OverlayCollector {
  overlayType: OverlayTypeName;
  component: unknown;
  idKind: OverlayIdKind;
  collect: (
    child: ReactElement,
    id: string,
    state: OverlayCollectorState,
    dependencies: OverlayCollectorDependencies,
  ) => void;
}

const overlayCollectors: OverlayCollector[] = [
  {
    overlayType: OverlayType.Marker,
    component: Marker,
    idKind: 'marker',
    collect: (child, id, state, dependencies) => {
      const props = child.props as MarkerProps;
      if (!isValidCoordinate(props.coordinate)) {
        warnOverlay(`marker "${id}" skipped: invalid coordinate`);
        return;
      }
      collectMarkerOverlay(id, props, state, dependencies.resolveMarkerImage);
    },
  },
  {
    overlayType: OverlayType.Polyline,
    component: Polyline,
    idKind: 'polyline',
    collect: (child, id, state) => {
      const props = child.props as PolylineProps;
      if (!isValidCoordinateList(props.coordinates, 2)) {
        warnOverlay(`polyline "${id}" skipped: invalid coordinates`);
        return;
      }

      state.polylines.push({
        id,
        coordinates: props.coordinates,
        strokeColor: props.strokeColor ?? undefined,
        strokeWidth: props.strokeWidth ?? undefined,
        tappable: tappableFromPress(props.onPress, props.tappable),
      });
      state.registry.set(overlayCallbackKey(OverlayType.Polyline, id), {
        onPress: props.onPress,
      });
      if (props.onPress != null) {
        state.hasPolylinePress = true;
      }
    },
  },
  {
    overlayType: OverlayType.Polygon,
    component: Polygon,
    idKind: 'polygon',
    collect: (child, id, state) => {
      const props = child.props as PolygonProps;
      if (!isValidCoordinateList(props.coordinates, 3)) {
        warnOverlay(`polygon "${id}" skipped: invalid coordinates`);
        return;
      }

      state.polygons.push({
        id,
        coordinates: props.coordinates,
        fillColor: props.fillColor ?? undefined,
        strokeColor: props.strokeColor ?? undefined,
        strokeWidth: props.strokeWidth ?? undefined,
        tappable: tappableFromPress(props.onPress, props.tappable),
      });
      state.registry.set(overlayCallbackKey(OverlayType.Polygon, id), {
        onPress: props.onPress,
      });
      if (props.onPress != null) {
        state.hasPolygonPress = true;
      }
    },
  },
  {
    overlayType: OverlayType.Circle,
    component: Circle,
    idKind: 'circle',
    collect: (child, id, state) => {
      const props = child.props as CircleProps;
      if (!isValidCoordinate(props.center)) {
        warnOverlay(`circle "${id}" skipped: invalid center coordinate`);
        return;
      }
      if (!isValidRadius(props.radius)) {
        warnOverlay(
          `circle "${id}" skipped: radius must be finite and non-negative`,
        );
        return;
      }

      state.circles.push({
        id,
        center: props.center,
        radius: props.radius,
        fillColor: props.fillColor ?? undefined,
        strokeColor: props.strokeColor ?? undefined,
        strokeWidth: props.strokeWidth ?? undefined,
        tappable: tappableFromPress(props.onPress, props.tappable),
      });
      state.registry.set(overlayCallbackKey(OverlayType.Circle, id), {
        onPress: props.onPress,
      });
      if (props.onPress != null) {
        state.hasCirclePress = true;
      }
    },
  },
  {
    overlayType: OverlayType.Geojson,
    component: Geojson,
    idKind: 'geojson',
    collect: (child, id, state) => {
      collectGeojsonOverlays(id, child.props as GeojsonProps, state);
    },
  },
];

function findOverlayCollector(
  child: ReactElement,
): OverlayCollector | undefined {
  return overlayCollectors.find((collector) =>
    isOverlayChild(child, collector.overlayType, collector.component),
  );
}

function idProp(child: ReactElement): string | undefined {
  return (child.props as { id?: string }).id;
}

export function collectOverlayChildren(
  children: ReactNode,
  dependencies: OverlayCollectorDependencies,
): OverlayCollectorState {
  const overlays: [ReactElement, OverlayCollector][] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    const collector = findOverlayCollector(child);
    if (collector != null) {
      overlays.push([child, collector]);
    }
  });

  const state = createOverlayCollectorState();
  // Every `id` prop first, so that a key or a position cannot take one given
  // to an overlay further on.
  for (const [child, collector] of overlays) {
    reserveOverlayId(state.ids, collector.idKind, idProp(child));
  }
  for (const [child, collector] of overlays) {
    const id = claimOverlayId(
      state.ids,
      collector.idKind,
      idProp(child),
      child.key,
    );
    collector.collect(child, id, state, dependencies);
  }

  return state;
}
