import { Image, type ImageSourcePropType } from 'react-native';
import type { MarkerImage } from '../native/specs/overlays';

export function resolveAssetSource(
  source: ImageSourcePropType | number,
): MarkerImage | null {
  // React Native 0.88 types the result as `| undefined`.
  return Image.resolveAssetSource(source) ?? null;
}
