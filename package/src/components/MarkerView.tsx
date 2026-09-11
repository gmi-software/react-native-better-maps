import { useContext } from 'react';
import type { ReactNode } from 'react';
import { NativeMarkerView } from '../native/MarkerViewNative';
import type { Coordinate } from '../types/coordinate';
import type { MarkerAnchor } from '../types/overlays';
import { MapChildrenContext } from './MapChildrenContext';

export interface MarkerViewProps {
  coordinate: Coordinate;
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
 * per-frame JS camera updates are used. Does not participate in clustering.
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
