import { useContext } from 'react';
import type { ReactNode } from 'react';
import { NativeMarkerView } from '../native/MarkerViewNative';
import type { Coordinate } from '../types/coordinate';
import type { MarkerAnchor } from '../types/overlays';
import { MapChildrenContext } from './MapChildrenContext';

export interface MarkerViewProps {
  /** Stable identity used in cluster membership and onClusterPress. */
  id?: string;
  coordinate: Coordinate;
  /** Defaults to true when clustering is enabled on the map. */
  clusterable?: boolean;
  /** Fixed layout bounds in points/dp. Animate content inside these bounds. */
  width: number;
  height: number;
  /** Point in the content attached to the coordinate; defaults to bottom-center. */
  anchor?: MarkerAnchor;
  /** Live React Native content, including Pressable and Animated views. */
  children: ReactNode;
}

/**
 * A live, screen-aligned marker. Its JSX stays in Fabric; no snapshots or
 * per-frame JS camera updates are used. Native clustering mounts only the
 * visible display set; keep persistent application state outside the marker.
 */
export function MarkerView({
  coordinate,
  width,
  height,
  anchor,
  children,
}: MarkerViewProps) {
  const isInsideMap = useContext(MapChildrenContext);
  if (!isInsideMap) {
    throw new Error('MarkerView must be a child of MapView');
  }
  validateMarkerViewProps({ coordinate, width, height, anchor, children });
  return (
    <NativeMarkerView
      coordinate={coordinate}
      anchor={anchor}
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
    >
      {children}
    </NativeMarkerView>
  );
}

export function validateMarkerViewProps({
  coordinate,
  width,
  height,
  anchor,
}: MarkerViewProps) {
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    throw new Error(
      'MarkerView width and height must be finite positive numbers',
    );
  }
  if (
    !Number.isFinite(coordinate.latitude) ||
    Math.abs(coordinate.latitude) > 90 ||
    !Number.isFinite(coordinate.longitude) ||
    Math.abs(coordinate.longitude) > 180
  ) {
    throw new Error(
      'MarkerView coordinate must contain a valid latitude and longitude',
    );
  }
  if (
    anchor != null &&
    (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y))
  ) {
    throw new Error('MarkerView anchor must contain finite values');
  }
}
