import type { MarkerImage, MarkerImageSource } from '../native/specs/overlays';
import { resolveAssetSource } from './assetSourceResolver';
import { LruCache } from './lruCache';
import {
  copyMarkerImage,
  isMarkerImage,
  markerImageFromResolvedAsset,
} from './markerImageFromResolvedAsset';
import { warnOverlay } from './warnOverlay';

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
    if (source.origin != null) {
      // On the cache miss only, so a re-rendering marker list does not repeat it.
      warnOverlay(
        `marker image "${source.uri}": "origin" is set by the library and was ignored`,
      );
    }
    // Always a copy: only the library stamps `origin`, so an image whose fields come from an
    // API response cannot claim `'bundled'` and skip the Android host policy — not even by
    // setting `origin` on its object after the cache took it.
    const image = copyMarkerImage(source);
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
