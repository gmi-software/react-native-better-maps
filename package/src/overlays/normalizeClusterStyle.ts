import type { ClusterStyleDescriptor } from '../native/specs/overlays';
import type { ClusterStyle } from '../types/overlays';
import { resolveMarkerImage } from './resolveMarkerImage';

export function normalizeClusterStyle(
  style: ClusterStyle | undefined,
): ClusterStyleDescriptor | undefined {
  if (style == null) {
    return undefined;
  }

  return {
    backgroundColor: style.backgroundColor ?? undefined,
    textColor: style.textColor ?? undefined,
    borderColor: style.borderColor ?? undefined,
    borderWidth: style.borderWidth ?? undefined,
    image: resolveMarkerImage(style.image ?? undefined),
  };
}
