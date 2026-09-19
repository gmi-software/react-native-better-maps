import type { MarkerImage, MarkerImageSource } from '../native/specs/overlays';
import type { MarkerProps } from '../types/overlays';
import { normalizeEnteringAnimation } from '../utils/enteringAnimation';
import {
  assignOverlayId,
  type OverlayChildKey,
  type OverlayCollectorState,
} from './overlayCollect';
import { OverlayType, overlayCallbackKey } from './overlayType';

export type MarkerImageResolver = (
  source: MarkerImageSource | undefined,
) => MarkerImage | undefined;

export function collectMarkerOverlay(
  props: MarkerProps,
  state: OverlayCollectorState,
  resolveMarkerImage: MarkerImageResolver,
  key?: OverlayChildKey,
): void {
  const id = assignOverlayId(state, props.id, key, 'marker', state.markerIndex);
  state.markerIndex += 1;

  state.markers.push({
    id,
    coordinate: props.coordinate,
    title: props.title,
    subtitle: props.subtitle,
    draggable: props.draggable,
    clusterable: props.clusterable,
    image: resolveMarkerImage(props.image),
    markerColor: props.markerColor,
    zIndex: props.zIndex,
    anchor: props.anchor,
    centerOffset: props.centerOffset,
    rotation: props.rotation,
    flat: props.flat,
    opacity: props.opacity,
    enteringAnimation: normalizeEnteringAnimation(props.enteringAnimation),
  });
  state.registry.set(overlayCallbackKey(OverlayType.Marker, id), {
    onPress: props.onPress,
    onDragEnd: props.onDragEnd,
  });
  if (props.onPress != null) state.hasMarkerPress = true;
  if (props.onDragEnd != null) state.hasMarkerDragEnd = true;
}
