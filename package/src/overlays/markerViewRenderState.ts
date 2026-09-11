import type { NativeMarkerViewRenderState } from '../native/specs/MapView.nitro';

export function markerViewRenderStatesEqual(
  previous: NativeMarkerViewRenderState | null,
  next: NativeMarkerViewRenderState,
): boolean {
  if (!previous) return false;
  const sameIds = (left: string[], right: string[]) =>
    left.length === right.length &&
    left.every((id, index) => id === right[index]);
  return (
    sameIds(previous.markerViewIds, next.markerViewIds) &&
    previous.clusters.length === next.clusters.length &&
    previous.clusters.every((cluster, index) => {
      const other = next.clusters[index];
      return (
        cluster.id === other.id &&
        cluster.coordinate.latitude === other.coordinate.latitude &&
        cluster.coordinate.longitude === other.coordinate.longitude &&
        cluster.region.latitude === other.region.latitude &&
        cluster.region.longitude === other.region.longitude &&
        cluster.region.latitudeDelta === other.region.latitudeDelta &&
        cluster.region.longitudeDelta === other.region.longitudeDelta &&
        sameIds(cluster.markerIds, other.markerIds)
      );
    })
  );
}
