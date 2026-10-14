import type {
  NativeMarkerViewCluster,
  NativeMarkerViewRenderState,
} from '../native/specs/MapView.nitro';
import type { Coordinate } from '../types/coordinate';

function stringListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function clustersEqual(
  left: NativeMarkerViewCluster,
  right: NativeMarkerViewCluster,
): boolean {
  return (
    left.id === right.id &&
    left.coordinate.latitude === right.coordinate.latitude &&
    left.coordinate.longitude === right.coordinate.longitude &&
    stringListsEqual(left.markerIds, right.markerIds)
  );
}

/**
 * Whether two native render states mount the same JSX. Native sorts both lists,
 * so equal states compare element by element. Lets a reinstalled callback that
 * republishes the same state skip a render.
 */
export function markerViewRenderStatesEqual(
  left: NativeMarkerViewRenderState | null,
  right: NativeMarkerViewRenderState | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  if (
    !stringListsEqual(left.markerIds, right.markerIds) ||
    left.clusters.length !== right.clusters.length
  ) {
    return false;
  }
  for (let index = 0; index < left.clusters.length; index += 1) {
    if (!clustersEqual(left.clusters[index], right.clusters[index])) {
      return false;
    }
  }
  return true;
}

/**
 * Where a cluster's members are now. Fitting these, rather than the cluster
 * region, always zooms far enough to split a dense cluster - the region has a
 * minimum span. Members that have since disappeared are left out.
 */
export function clusterMemberCoordinates(
  markerIds: readonly string[],
  markers: readonly { id: string; coordinate: Coordinate }[],
): Coordinate[] {
  const members = new Set(markerIds);
  const coordinates: Coordinate[] = [];
  for (const marker of markers) {
    if (members.has(marker.id)) {
      coordinates.push(marker.coordinate);
    }
  }
  return coordinates;
}
