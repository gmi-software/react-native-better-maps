import type { MarkerImage, MarkerImageSource } from '../native/specs/overlays';
import { resolveAssetSource } from './assetSourceResolver';
import { LruCache } from './lruCache';
import {
  isMarkerImage,
  markerImageFromResolvedAsset,
} from './markerImageFromResolvedAsset';
import { warnOverlay } from './warnOverlay';

const MARKER_IMAGE_CACHE_SIZE = 64;
const resolvedImageCache = new LruCache<string, MarkerImage>(MARKER_IMAGE_CACHE_SIZE);

function markerImageCacheKey(image: MarkerImage): string {
  return `${image.uri}|${image.width ?? ''}|${image.height ?? ''}|${image.scale ?? ''}`;
}

/**
 * Provenance is stamped by this module alone: an image whose fields come from an API
 * response must not be able to claim `'bundled'` and skip the Android host policy.
 */
function withoutOrigin(image: MarkerImage): MarkerImage {
  const { origin: _origin, ...rest } = image;
  return rest;
}

export function resolveMarkerImage(
  source: MarkerImageSource | undefined,
): MarkerImage | undefined {
  if (source == null) {
    return undefined;
  }

  if (isMarkerImage(source)) {
    const image = source.origin === undefined ? source : withoutOrigin(source);
    const key = markerImageCacheKey(image);
    const cached = resolvedImageCache.get(key);
    if (cached != null) {
      return cached;
    }
    if (source.origin !== undefined) {
      // On the cache miss only, so a re-rendering marker list does not repeat it.
      warnOverlay(
        `marker image "${image.uri}": "origin" is set by the library and was ignored`,
      );
    }
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
