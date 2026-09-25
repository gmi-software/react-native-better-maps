import type { MarkerImage, MarkerImageSource } from '../native/specs/overlays';
import { resolveAssetSource } from './assetSourceResolver';
import { LruCache } from './lruCache';
import {
  isMarkerImage,
  markerImageFromResolvedAsset,
  markerImageWithoutNulls,
} from './markerImageFromResolvedAsset';

const MARKER_IMAGE_CACHE_SIZE = 64;
const resolvedImageCache = new LruCache<string, MarkerImage>(MARKER_IMAGE_CACHE_SIZE);

function markerImageCacheKey(image: MarkerImage): string {
  return `${image.uri}|${image.width ?? ''}|${image.height ?? ''}|${image.scale ?? ''}`;
}

export function resolveMarkerImage(
  source: MarkerImageSource | undefined,
): MarkerImage | undefined {
  if (source == null) {
    return undefined;
  }

  if (isMarkerImage(source)) {
    const key = markerImageCacheKey(source);
    const cached = resolvedImageCache.get(key);
    if (cached != null) {
      return cached;
    }
    const image = markerImageWithoutNulls(source);
    resolvedImageCache.set(key, image);
    return image;
  }

  if (typeof source === 'number') {
    const requireKey = `require:${source}`;
    const cached = resolvedImageCache.get(requireKey);
    if (cached != null) {
      return cached;
    }

    const resolved = markerImageFromResolvedAsset(resolveAssetSource(source));
    if (resolved != null) {
      resolvedImageCache.set(requireKey, resolved);
    }
    return resolved;
  }

  return undefined;
}

export function clearResolvedMarkerImageCacheForTests(): void {
  resolvedImageCache.clear();
}
