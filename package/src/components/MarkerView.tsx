import { useContext, useMemo } from 'react';
import { NativeMarkerView } from '../native/MarkerViewNative';
import type { OverlayComponentType } from '../overlays/overlayType';
import { OverlayType } from '../overlays/overlayType';
import { warnOverlay } from '../overlays/warnOverlay';
import type { MarkerViewProps } from '../types/markerView';
import { MarkerViewHostContext } from './MarkerViewHostContext';

/**
 * A marker drawn by live React Native content instead of an image: state,
 * `Pressable`, Reanimated animations and all.
 *
 * Use it as a direct child of {@linkcode MapView}. The map places it with its
 * native projection on every camera frame - no JS runs and nothing is
 * snapshotted while the camera moves - and mounts its JSX only while the
 * native clustering and viewport pipeline shows it. A marker grouped into a
 * cluster or scrolled far off screen is unmounted, so keep state that has to
 * outlive that in your app, not in the marker.
 *
 * For large static datasets prefer {@linkcode Marker}: an SDK-drawn image
 * costs far less than a live view.
 */
export function MarkerView({
  coordinate,
  width,
  height,
  anchor,
  children,
}: MarkerViewProps) {
  const isInMap = useContext(MarkerViewHostContext);
  const style = useMemo(
    () => ({ position: 'absolute' as const, left: 0, top: 0, width, height }),
    [width, height],
  );

  if (!isInMap) {
    warnOverlay('MarkerView renders only as a direct child of MapView.');
    return null;
  }

  return (
    <NativeMarkerView
      coordinate={coordinate}
      anchor={anchor ?? undefined}
      style={style}
    >
      {children}
    </NativeMarkerView>
  );
}

(MarkerView as OverlayComponentType).overlayType = OverlayType.MarkerView;
