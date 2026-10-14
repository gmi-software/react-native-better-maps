import type { HybridView, HybridViewProps } from 'react-native-nitro-modules';
import type { Coordinate } from '../../types/coordinate';
import type { MarkerAnchor } from './overlays';

/** Native props for the live `MarkerView` host. */
export interface MarkerViewProps extends HybridViewProps {
  coordinate: Coordinate;
  /** Point of the host attached to `coordinate`; defaults to bottom-center. */
  anchor?: MarkerAnchor;
}

/** A live Fabric subtree that the map positions with its native projection. */
export type MarkerView = HybridView<MarkerViewProps>;
