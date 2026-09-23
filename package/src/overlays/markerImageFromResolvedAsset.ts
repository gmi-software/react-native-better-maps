import type { MarkerImage } from '../native/specs/overlays';

/**
 * Converts `Image.resolveAssetSource` output into a `MarkerImage`. Only a `require()`d
 * asset reaches this function, so the result carries `origin: 'bundled'`.
 */
export function markerImageFromResolvedAsset(
  resolved: MarkerImage | null | undefined,
): MarkerImage | undefined {
  if (resolved == null || resolved.uri.length === 0) {
    return undefined;
  }

  return {
    uri: resolved.uri,
    width: resolved.width,
    height: resolved.height,
    scale: resolved.scale,
    origin: 'bundled',
  };
}

export function isMarkerImage(value: unknown): value is MarkerImage {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.uri !== 'string' || record.uri.length === 0) {
    return false;
  }

  if (record.width !== undefined && typeof record.width !== 'number') {
    return false;
  }

  if (record.height !== undefined && typeof record.height !== 'number') {
    return false;
  }

  if (record.scale !== undefined && typeof record.scale !== 'number') {
    return false;
  }

  return true;
}
