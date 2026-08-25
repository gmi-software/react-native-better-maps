import type {
  GeojsonFeature,
  GeojsonGeometry,
  GeojsonPosition,
} from '../types/geojson';
import { warnGeojson } from './warnGeojson';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function readType(value: Record<string, unknown>): string | undefined {
  return typeof value.type === 'string' ? value.type : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function isBbox(value: unknown): value is number[] {
  return isNumberArray(value) && value.length >= 4 && value.length % 2 === 0;
}

function isPosition(value: unknown): value is GeojsonPosition {
  return isNumberArray(value) && value.length >= 2;
}

function isPositionArray(
  value: unknown,
  minimumLength: number,
): value is GeojsonPosition[] {
  return (
    Array.isArray(value) &&
    value.length >= minimumLength &&
    value.every(isPosition)
  );
}

function positionsEqual(
  left: GeojsonPosition,
  right: GeojsonPosition,
): boolean {
  return (
    left.length === right.length &&
    left.every((coordinate, index) => coordinate === right[index])
  );
}

function isLinearRing(value: unknown): value is GeojsonPosition[] {
  if (!isPositionArray(value, 4)) {
    return false;
  }

  const first = value[0];
  const last = value[value.length - 1];
  return first != null && last != null && positionsEqual(first, last);
}

function isPolygonCoordinates(value: unknown): value is GeojsonPosition[][] {
  return Array.isArray(value) && value.length > 0 && value.every(isLinearRing);
}

function hasValidBbox(value: Record<string, unknown>): boolean {
  return !('bbox' in value) || isBbox(value.bbox);
}

function isGeojsonGeometry(value: unknown): value is GeojsonGeometry {
  if (!isRecord(value) || !hasValidBbox(value)) {
    return false;
  }

  switch (readType(value)) {
    case 'Point':
      return isPosition(value.coordinates);
    case 'MultiPoint':
      return isPositionArray(value.coordinates, 1);
    case 'LineString':
      return isPositionArray(value.coordinates, 2);
    case 'MultiLineString':
      return (
        Array.isArray(value.coordinates) &&
        value.coordinates.length > 0 &&
        value.coordinates.every((line) => isPositionArray(line, 2))
      );
    case 'Polygon':
      return isPolygonCoordinates(value.coordinates);
    case 'MultiPolygon':
      return (
        Array.isArray(value.coordinates) &&
        value.coordinates.length > 0 &&
        value.coordinates.every(isPolygonCoordinates)
      );
    case 'GeometryCollection':
      return (
        Array.isArray(value.geometries) &&
        value.geometries.every(isGeojsonGeometry)
      );
    default:
      return false;
  }
}

function hasValidFeatureId(value: Record<string, unknown>): boolean {
  return (
    !('id' in value) ||
    (typeof value.id === 'string' && value.id.length > 0) ||
    (typeof value.id === 'number' && Number.isFinite(value.id))
  );
}

function isGeojsonFeature(value: unknown): value is GeojsonFeature {
  if (
    !isRecord(value) ||
    readType(value) !== 'Feature' ||
    !hasValidBbox(value) ||
    !hasValidFeatureId(value)
  ) {
    return false;
  }

  const properties = value.properties;
  if (properties !== null && !isRecord(properties)) {
    return false;
  }

  const geometry = value.geometry;
  return geometry === null || isGeojsonGeometry(geometry);
}

function parseFeature(value: unknown): GeojsonFeature | undefined {
  if (!isGeojsonFeature(value)) {
    warnGeojson('Skipping invalid Feature.');
    return undefined;
  }

  return value;
}

function wrapGeometry(geometry: GeojsonGeometry): GeojsonFeature {
  return {
    type: 'Feature',
    properties: null,
    geometry,
  };
}

function parseGeojsonObject(value: unknown): GeojsonFeature[] {
  if (!isRecord(value)) {
    warnGeojson('GeoJSON input must be an object or JSON string.');
    return [];
  }

  switch (readType(value)) {
    case 'FeatureCollection': {
      if (!Array.isArray(value.features)) {
        warnGeojson('FeatureCollection.features must be an array.');
        return [];
      }

      const features: GeojsonFeature[] = [];
      for (const item of value.features) {
        const feature = parseFeature(item);
        if (feature != null) {
          features.push(feature);
        }
      }
      return features;
    }
    case 'Feature': {
      const feature = parseFeature(value);
      return feature == null ? [] : [feature];
    }
    case 'Point':
    case 'MultiPoint':
    case 'LineString':
    case 'MultiLineString':
    case 'Polygon':
    case 'MultiPolygon':
    case 'GeometryCollection':
      if (!isGeojsonGeometry(value)) {
        warnGeojson('Skipping invalid GeoJSON geometry.');
        return [];
      }
      return [wrapGeometry(value)];
    default:
      warnGeojson(`Unsupported GeoJSON type "${readType(value) ?? ''}".`);
      return [];
  }
}

export function parseGeojsonFeatures(input: unknown): GeojsonFeature[] {
  if (typeof input === 'string') {
    try {
      return parseGeojsonObject(JSON.parse(input) as unknown);
    } catch {
      warnGeojson('Failed to parse GeoJSON string as JSON.');
      return [];
    }
  }

  return parseGeojsonObject(input);
}
