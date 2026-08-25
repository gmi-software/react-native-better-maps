import type {
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';
import type { Coordinate } from '../types/coordinate';
import type {
  GeojsonFeature,
  GeojsonGeometry,
  GeojsonInput,
  GeojsonOverlayDescriptors,
  GeojsonPosition,
  GeojsonToOverlayOptions,
} from '../types/geojson';
import {
  lineToCoordinates,
  positionToCoordinate,
  ringToCoordinates,
} from './geojsonCoordinates';
import {
  resolveMarkerTitle,
  resolvePaintColor,
  resolveStrokeWidth,
} from './geojsonStyle';
import { parseGeojsonFeatures } from './parseGeojson';
import { warnGeojson } from './warnGeojson';

const DEFAULT_LAYER_ID = 'geojson';
const LARGE_OVERLAY_WARN_LIMIT = 1000;

interface ConversionState {
  layerId: string;
  options: GeojsonToOverlayOptions;
  markers: MarkerDescriptor[];
  polylines: PolylineDescriptor[];
  polygons: PolygonDescriptor[];
  featuresByOverlayId: Record<string, GeojsonFeature>;
  markerIndex: number;
  polylineIndex: number;
  polygonIndex: number;
}

function overlayId(
  layerId: string,
  feature: GeojsonFeature,
  kind: 'marker' | 'polyline' | 'polygon',
  index: number,
): string {
  const featureId = feature.id;
  if (
    (typeof featureId === 'string' && featureId.length > 0) ||
    (typeof featureId === 'number' && Number.isFinite(featureId))
  ) {
    return `${layerId}:${featureId}:${kind}-${index}`;
  }

  return `${layerId}:${kind}-${index}`;
}

function convertPoint(
  state: ConversionState,
  feature: GeojsonFeature,
  coordinate: Coordinate,
): void {
  const id = overlayId(state.layerId, feature, 'marker', state.markerIndex);
  state.markerIndex += 1;
  state.markers.push({
    id,
    coordinate,
    title: resolveMarkerTitle(feature.properties, state.options.title),
  });
  state.featuresByOverlayId[id] = feature;
}

function convertLine(
  state: ConversionState,
  feature: GeojsonFeature,
  coordinates: Coordinate[],
): void {
  const id = overlayId(state.layerId, feature, 'polyline', state.polylineIndex);
  state.polylineIndex += 1;
  state.polylines.push({
    id,
    coordinates,
    strokeColor: resolvePaintColor(
      feature.properties,
      'stroke',
      state.options.strokeColor,
    ),
    strokeWidth: resolveStrokeWidth(
      feature.properties,
      state.options.strokeWidth,
    ),
    tappable: state.options.tappable,
  });
  state.featuresByOverlayId[id] = feature;
}

function convertPolygon(
  state: ConversionState,
  feature: GeojsonFeature,
  rings: GeojsonPosition[][],
): void {
  const exterior = rings[0];
  if (exterior == null) {
    return;
  }

  const holes = rings.slice(1).map(ringToCoordinates);
  const id = overlayId(state.layerId, feature, 'polygon', state.polygonIndex);
  state.polygonIndex += 1;
  state.polygons.push({
    id,
    coordinates: ringToCoordinates(exterior),
    holes: holes.length > 0 ? holes : undefined,
    fillColor: resolvePaintColor(
      feature.properties,
      'fill',
      state.options.fillColor,
    ),
    strokeColor: resolvePaintColor(
      feature.properties,
      'stroke',
      state.options.strokeColor,
    ),
    strokeWidth: resolveStrokeWidth(
      feature.properties,
      state.options.strokeWidth,
    ),
    tappable: state.options.tappable,
  });
  state.featuresByOverlayId[id] = feature;
}

function convertGeometry(
  state: ConversionState,
  feature: GeojsonFeature,
  geometry: GeojsonGeometry,
): void {
  switch (geometry.type) {
    case 'Point':
      convertPoint(state, feature, positionToCoordinate(geometry.coordinates));
      return;
    case 'MultiPoint':
      for (const position of geometry.coordinates) {
        convertPoint(state, feature, positionToCoordinate(position));
      }
      return;
    case 'LineString':
      convertLine(state, feature, lineToCoordinates(geometry.coordinates));
      return;
    case 'MultiLineString':
      for (const line of geometry.coordinates) {
        convertLine(state, feature, lineToCoordinates(line));
      }
      return;
    case 'Polygon':
      convertPolygon(state, feature, geometry.coordinates);
      return;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) {
        convertPolygon(state, feature, polygon);
      }
      return;
    case 'GeometryCollection':
      for (const child of geometry.geometries) {
        convertGeometry(state, feature, child);
      }
      return;
    default: {
      const exhaustive: never = geometry;
      return exhaustive;
    }
  }
}

/**
 * Converts GeoJSON into marker, polyline, and polygon descriptors.
 *
 * Prefer the GeoJSON overlay child for typical use. Use this helper with bulk
 * `markers` / `polylines` / `polygons` props for large FeatureCollections.
 *
 * Invalid geometry is skipped with a development warning. Altitude (Z) values
 * are ignored when rendering.
 */
export function geojsonToOverlayDescriptors(
  geojson: GeojsonInput,
  options: GeojsonToOverlayOptions = {},
): GeojsonOverlayDescriptors {
  const layerId =
    options.id != null && options.id.length > 0 ? options.id : DEFAULT_LAYER_ID;
  const state: ConversionState = {
    layerId,
    options,
    markers: [],
    polylines: [],
    polygons: [],
    featuresByOverlayId: {},
    markerIndex: 0,
    polylineIndex: 0,
    polygonIndex: 0,
  };

  for (const feature of parseGeojsonFeatures(geojson)) {
    if (feature.geometry != null) {
      convertGeometry(state, feature, feature.geometry);
    }
  }

  const overlayCount =
    state.markers.length + state.polylines.length + state.polygons.length;
  if (overlayCount > LARGE_OVERLAY_WARN_LIMIT) {
    warnGeojson(
      `Converted ${overlayCount} overlays. FeatureCollections above ${LARGE_OVERLAY_WARN_LIMIT} overlays may stutter; prefer bulk MapView overlay props or simplify the data.`,
    );
  }

  return {
    markers: state.markers,
    polylines: state.polylines,
    polygons: state.polygons,
    featuresByOverlayId: state.featuresByOverlayId,
  };
}
