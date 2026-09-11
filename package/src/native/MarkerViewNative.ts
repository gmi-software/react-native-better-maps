import { getHostComponent } from 'react-native-nitro-modules';
import type { HybridViewMethods } from 'react-native-nitro-modules';
import MarkerViewConfig from '../../nitrogen/generated/shared/json/MarkerViewConfig.json';
import type { MarkerViewProps } from './specs/MarkerView.nitro';

export const NativeMarkerView = getHostComponent<
  MarkerViewProps,
  HybridViewMethods
>('MarkerView', () => MarkerViewConfig);
