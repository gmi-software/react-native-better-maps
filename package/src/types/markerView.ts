import type { ReactElement, ReactNode } from 'react';
import type { Coordinate } from './coordinate';
import type { MarkerAnchor } from './overlays';

/** Props of {@linkcode MarkerView}. */
export interface MarkerViewProps {
  /**
   * Identifies the marker in cluster membership and `onClusterPress`. Shares
   * one set of ids with `Marker`; defaults to the React key, else the position.
   */
  id?: string;

  /** Geographic position of the anchor point. */
  coordinate: Coordinate;

  /** Whether the marker joins clusters when clustering is enabled on the map. Default true. */
  clusterable?: boolean;

  /**
   * Fixed size of the marker in points / dp. It bounds layout, clipping and
   * touches and is what `anchor` refers to: animate content inside it, not it.
   */
  width: number;
  height: number;

  /** Point of the marker placed on `coordinate`, as fractions of its size. Default bottom-center. */
  anchor?: MarkerAnchor;

  /** Live React Native content: state, `Pressable`, Reanimated animations. */
  children?: ReactNode;
}

/** A cluster handed to `renderCluster`. */
export interface MarkerViewCluster {
  /** Stable while the cluster stays on screen, also as its count changes. */
  id: string;
  coordinate: Coordinate;
  count: number;
  /** Ids of the markers it groups, `Marker` and `MarkerView` alike. */
  markerIds: string[];
  /**
   * Calls `onClusterPress` and zooms the map to the cluster's markers, as a
   * press on a default cluster badge does. Resolves when the camera arrives.
   */
  onPress: () => Promise<void>;
}

/** Draws a cluster as a live marker. Must return a `MarkerView`, whose `coordinate` the map sets. */
export type RenderMarkerViewCluster = (
  cluster: MarkerViewCluster,
) => ReactElement<MarkerViewProps> | null;
