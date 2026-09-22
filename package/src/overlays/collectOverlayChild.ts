import type { ReactElement } from 'react';
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
  resolveOverlayId,
  tappableFromPress,
  type OverlayCollectorState,
} from './overlayCollect';
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
  collect: (
    child: ReactElement,
    state: OverlayCollectorState,
    dependencies: OverlayCollectorDependencies,
  ) => void;
}

const overlayCollectors: OverlayCollector[] = [
  {
    overlayType: OverlayType.Marker,
    component: Marker,
    collect: (child, state, dependencies) => {
      const props = child.props as MarkerProps;
      const id = resolveOverlayId(props.id, 'marker', state.markerIndex);
      if (!isValidCoordinate(props.coordinate)) {
        state.markerIndex += 1;
        warnOverlay(`marker "${id}" skipped: invalid coordinate`);
        return;
      }
      collectMarkerOverlay(props, state, dependencies.resolveMarkerImage);
    },
  },
  {
    overlayType: OverlayType.Polyline,
    component: Polyline,
    collect: (child, state) => {
      const props = child.props as PolylineProps;
      const id = resolveOverlayId(props.id, 'polyline', state.polylineIndex);
      state.polylineIndex += 1;

      if (!isValidCoordinateList(props.coordinates, 2)) {
        warnOverlay(`polyline "${id}" skipped: invalid coordinates`);
        return;
      }

      state.polylines.push({
        id,
        coordinates: props.coordinates,
        strokeColor: props.strokeColor,
        strokeWidth: props.strokeWidth,
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
    collect: (child, state) => {
      const props = child.props as PolygonProps;
      const id = resolveOverlayId(props.id, 'polygon', state.polygonIndex);
      state.polygonIndex += 1;

      if (!isValidCoordinateList(props.coordinates, 3)) {
        warnOverlay(`polygon "${id}" skipped: invalid coordinates`);
        return;
      }

      state.polygons.push({
        id,
        coordinates: props.coordinates,
        fillColor: props.fillColor,
        strokeColor: props.strokeColor,
        strokeWidth: props.strokeWidth,
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
    collect: (child, state) => {
      const props = child.props as CircleProps;
      const id = resolveOverlayId(props.id, 'circle', state.circleIndex);
      state.circleIndex += 1;

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
        fillColor: props.fillColor,
        strokeColor: props.strokeColor,
        strokeWidth: props.strokeWidth,
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
    collect: (child, state) => {
      collectGeojsonOverlays(child.props as GeojsonProps, state);
    },
  },
];

export function collectOverlayChild(
  child: ReactElement,
  state: OverlayCollectorState,
  dependencies: OverlayCollectorDependencies,
): void {
  for (const collector of overlayCollectors) {
    if (!isOverlayChild(child, collector.overlayType, collector.component)) {
      continue;
    }

    collector.collect(child, state, dependencies);
    return;
  }
}
