import type {
  MarkerDescriptor,
  PolygonDescriptor,
  PolylineDescriptor,
} from '../native/specs/overlays';

/** GeoJSON position as `[longitude, latitude]`, optionally with ignored altitude. */
export type GeojsonPosition = number[];

export interface GeojsonPoint {
  type: 'Point';
  coordinates: GeojsonPosition;
  bbox?: number[];
}

export interface GeojsonMultiPoint {
  type: 'MultiPoint';
  coordinates: GeojsonPosition[];
  bbox?: number[];
}

export interface GeojsonLineString {
  type: 'LineString';
  coordinates: GeojsonPosition[];
  bbox?: number[];
}

export interface GeojsonMultiLineString {
  type: 'MultiLineString';
  coordinates: GeojsonPosition[][];
  bbox?: number[];
}

/** First ring is the exterior; additional rings are holes and are ignored when rendering. */
export interface GeojsonPolygon {
  type: 'Polygon';
  coordinates: GeojsonPosition[][];
  bbox?: number[];
}

export interface GeojsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: GeojsonPosition[][][];
  bbox?: number[];
}

export interface GeojsonGeometryCollection {
  type: 'GeometryCollection';
  geometries: GeojsonGeometry[];
  bbox?: number[];
}

export type GeojsonGeometry =
  | GeojsonPoint
  | GeojsonMultiPoint
  | GeojsonLineString
  | GeojsonMultiLineString
  | GeojsonPolygon
  | GeojsonMultiPolygon
  | GeojsonGeometryCollection;

/** Feature received by {@linkcode GeojsonProps.onPress}. */
export interface GeojsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: GeojsonGeometry | null;
  bbox?: number[];
}

export interface GeojsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeojsonFeature[];
  bbox?: number[];
}

export type GeojsonObject =
  GeojsonFeature | GeojsonFeatureCollection | GeojsonGeometry;

/** GeoJSON object or JSON string. Invalid input is skipped with a development warning. */
export type GeojsonInput = GeojsonObject | string;

export interface GeojsonToOverlayOptions {
  /**
   * Overlay id prefix used for generated markers, polylines, and polygons.
   *
   * @default 'geojson'
   */
  id?: string;

  /**
   * Default stroke color for lines and polygons when a feature does not set
   * `properties.stroke`.
   */
  strokeColor?: string;

  /**
   * Default fill color for polygons when a feature does not set
   * `properties.fill`.
   */
  fillColor?: string;

  /**
   * Default stroke width in density-independent pixels when a feature does not
   * set `properties['stroke-width']`.
   */
  strokeWidth?: number;

  /**
   * Whether generated polylines and polygons are tappable.
   * Set to `true` when {@linkcode GeojsonProps.onPress} is provided.
   */
  tappable?: boolean;

  /**
   * Default marker title when a Point feature does not set `properties.title`
   * or `properties.name`.
   */
  title?: string;
}

export interface GeojsonOverlayDescriptors {
  /** Point and MultiPoint features, one marker per position. */
  markers: MarkerDescriptor[];

  /** LineString and MultiLineString features, one polyline per line. */
  polylines: PolylineDescriptor[];

  /** Polygon and MultiPolygon features, one polygon per outer ring. */
  polygons: PolygonDescriptor[];

  /**
   * Source {@linkcode GeojsonFeature} for each generated overlay id. Use this
   * to wire bulk overlay press callbacks back to feature properties.
   */
  featuresByOverlayId: Record<string, GeojsonFeature>;
}

export interface GeojsonProps extends GeojsonToOverlayOptions {
  /**
   * GeoJSON object or JSON string. FeatureCollections, Features, geometry
   * objects, and GeometryCollections are flattened into markers, polylines,
   * and polygons.
   */
  geojson: GeojsonInput;

  /** Called when a generated overlay is pressed. */
  onPress?: (feature: GeojsonFeature) => void;
}
