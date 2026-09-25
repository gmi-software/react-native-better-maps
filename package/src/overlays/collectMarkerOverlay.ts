import type {
  MarkerDescriptor,
  MarkerImage,
  MarkerImageSource,
} from '../native/specs/overlays';
import type {
  MarkerProps,
  MarkerDescriptor as PublicMarkerDescriptor,
} from '../types/overlays';
import { normalizeEnteringAnimation } from '../utils/enteringAnimation';
import { resolveOverlayId, type OverlayCollectorState } from './overlayCollect';
import { OverlayType, overlayCallbackKey } from './overlayType';

export type MarkerImageResolver = (
  source: MarkerImageSource | undefined,
) => MarkerImage | undefined;

/**
 * Builds the native descriptor for one marker, from the props of a `<Marker>`
 * child or from an entry of the bulk `markers` prop.
 *
 * Optional fields are written as `value ?? undefined` on purpose. Nitro treats
 * only `undefined` as an absent optional field; a `null` - which is how JSON and
 * other untyped data say "no value" - makes it throw, and for the whole
 * `markers` array rather than for this one marker.
 */
export function buildMarkerDescriptor(
  id: string,
  marker: Omit<PublicMarkerDescriptor, 'id'>,
  resolveMarkerImage: MarkerImageResolver,
): MarkerDescriptor {
  return {
    id,
    coordinate: marker.coordinate,
    title: marker.title ?? undefined,
    subtitle: marker.subtitle ?? undefined,
    draggable: marker.draggable ?? undefined,
    clusterable: marker.clusterable ?? undefined,
    image: resolveMarkerImage(marker.image),
    markerColor: marker.markerColor ?? undefined,
    zIndex: marker.zIndex ?? undefined,
    anchor: marker.anchor ?? undefined,
    centerOffset: marker.centerOffset ?? undefined,
    rotation: marker.rotation ?? undefined,
    flat: marker.flat ?? undefined,
    opacity: marker.opacity ?? undefined,
    enteringAnimation: normalizeEnteringAnimation(marker.enteringAnimation),
  };
}

export function collectMarkerOverlay(
  props: MarkerProps,
  state: OverlayCollectorState,
  resolveMarkerImage: MarkerImageResolver,
): void {
  const id = resolveOverlayId(props.id, 'marker', state.markerIndex);
  state.markerIndex += 1;

  state.markers.push(buildMarkerDescriptor(id, props, resolveMarkerImage));
  state.registry.set(overlayCallbackKey(OverlayType.Marker, id), {
    onPress: props.onPress,
    onDragEnd: props.onDragEnd,
  });
  if (props.onPress != null) state.hasMarkerPress = true;
  if (props.onDragEnd != null) state.hasMarkerDragEnd = true;
}
