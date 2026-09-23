import type { MarkerImage } from '../native/specs/overlays';

function copyMarkerImage(image: MarkerImage): MarkerImage {
  return {
    uri: image.uri,
    width: image.width ?? undefined,
    height: image.height ?? undefined,
    scale: image.scale ?? undefined,
  };
}

export function markerImageFromResolvedAsset(
  resolved: MarkerImage | null | undefined,
): MarkerImage | undefined {
  if (resolved == null || resolved.uri.length === 0) {
    return undefined;
  }

  return copyMarkerImage(resolved);
}

export function markerImageWithoutNulls(image: MarkerImage): MarkerImage {
  if (image.width === null || image.height === null || image.scale === null) {
    return copyMarkerImage(image);
  }

  return image;
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
