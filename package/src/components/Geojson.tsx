import type { OverlayComponentType } from '../overlays/overlayType';
import { OverlayType } from '../overlays/overlayType';
import type { GeojsonProps } from '../types/geojson';

/**
 * GeoJSON overlay child for {@linkcode MapView}.
 *
 * Props are collected by the parent `MapView` and converted into marker,
 * polyline, and polygon descriptors.
 */
export function Geojson(_props: GeojsonProps): null {
  return null;
}

(Geojson as OverlayComponentType).overlayType = OverlayType.Geojson;
