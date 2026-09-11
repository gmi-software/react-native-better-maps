import type { HybridView, HybridViewProps } from 'react-native-nitro-modules';
import type { Coordinate } from '../../types/coordinate';
import type { MarkerAnchor } from './overlays';

export interface MarkerViewProps extends HybridViewProps {
  coordinate: Coordinate;
  anchor?: MarkerAnchor;
}

/** A live Fabric subtree positioned by the native map projection. */
export type MarkerView = HybridView<MarkerViewProps>;
