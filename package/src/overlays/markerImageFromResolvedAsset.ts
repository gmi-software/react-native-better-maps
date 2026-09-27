import type { MarkerImage } from '../native/specs/overlays';

/**
 * A new `MarkerImage` holding only the fields the native side reads, with a `null` field
 * left out, since Nitro throws on one. `origin` is never copied: the library stamps
 * provenance, it does not read it from the input.
 */
export function copyMarkerImage(image: MarkerImage): MarkerImage {
  return {
    uri: image.uri,
    width: image.width ?? undefined,
    height: image.height ?? undefined,
    scale: image.scale ?? undefined,
  };
}

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

  return { ...copyMarkerImage(resolved), origin: 'bundled' };
}

export function isMarkerImage(value: unknown): value is MarkerImage {
  if (typeof value !== 'object' || value == null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.uri !== 'string' || record.uri.length === 0) {
    return false;
  }

  if (record.width != null && typeof record.width !== 'number') {
    return false;
  }

  if (record.height != null && typeof record.height !== 'number') {
    return false;
  }

  if (record.scale != null && typeof record.scale !== 'number') {
    return false;
  }

  return true;
}
