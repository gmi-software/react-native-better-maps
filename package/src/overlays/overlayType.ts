/**
 * Stable overlay identifiers used when collecting MapView children.
 *
 * Reference equality (`child.type === Marker`) breaks when Metro resolves the
 * same component through different module paths (common in monorepos).
 */
export const OverlayType = {
  Marker: 'NitroMaps.Marker',
  Polyline: 'NitroMaps.Polyline',
  Polygon: 'NitroMaps.Polygon',
  Circle: 'NitroMaps.Circle',
  Geojson: 'NitroMaps.Geojson',
} as const;

export type OverlayTypeName = (typeof OverlayType)[keyof typeof OverlayType];

export interface OverlayComponentType {
  overlayType?: OverlayTypeName;
}

export function overlayCallbackKey(type: OverlayTypeName, id: string): string {
  return `${type}:${id}`;
}
