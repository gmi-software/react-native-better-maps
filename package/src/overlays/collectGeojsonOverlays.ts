import { geojsonToOverlayDescriptors } from '../geojson/geojsonToDescriptors';
import type {
  GeojsonFeature,
  GeojsonOverlayDescriptors,
  GeojsonProps,
} from '../types/geojson';
import {
  tappableFromPress,
  resolveOverlayId,
  type OverlayCollectorState,
} from './overlayCollect';
import { OverlayType, overlayCallbackKey } from './overlayType';
import type { OverlayTypeName } from './overlayType';

function bindFeaturePress(
  state: OverlayCollectorState,
  overlayType: OverlayTypeName,
  overlayId: string,
  feature: GeojsonFeature | undefined,
  onFeaturePress: GeojsonProps['onPress'],
): void {
  if (onFeaturePress == null || feature == null) {
    return;
  }

  state.registry.set(overlayCallbackKey(overlayType, overlayId), {
    onPress: () => {
      onFeaturePress(feature);
    },
  });
}

function mergeConvertedOverlays(
  state: OverlayCollectorState,
  converted: GeojsonOverlayDescriptors,
  onFeaturePress: GeojsonProps['onPress'],
): void {
  state.markers.push(...converted.markers);
  state.polylines.push(...converted.polylines);
  state.polygons.push(...converted.polygons);

  for (const marker of converted.markers) {
    bindFeaturePress(
      state,
      OverlayType.Marker,
      marker.id,
      converted.featuresByOverlayId[marker.id],
      onFeaturePress,
    );
  }
  for (const polyline of converted.polylines) {
    bindFeaturePress(
      state,
      OverlayType.Polyline,
      polyline.id,
      converted.featuresByOverlayId[polyline.id],
      onFeaturePress,
    );
  }
  for (const polygon of converted.polygons) {
    bindFeaturePress(
      state,
      OverlayType.Polygon,
      polygon.id,
      converted.featuresByOverlayId[polygon.id],
      onFeaturePress,
    );
  }

  if (onFeaturePress != null) {
    state.hasMarkerPress ||= converted.markers.length > 0;
    state.hasPolylinePress ||= converted.polylines.length > 0;
    state.hasPolygonPress ||= converted.polygons.length > 0;
  }
}

export function collectGeojsonOverlays(
  props: GeojsonProps,
  state: OverlayCollectorState,
): void {
  const layerId = resolveOverlayId(props.id, 'geojson', state.geojsonIndex);
  state.geojsonIndex += 1;

  const converted = geojsonToOverlayDescriptors(props.geojson, {
    id: layerId,
    strokeColor: props.strokeColor,
    fillColor: props.fillColor,
    markerColor: props.markerColor,
    strokeWidth: props.strokeWidth,
    tappable: tappableFromPress(props.onPress, props.tappable),
    title: props.title,
    zIndex: props.zIndex,
  });

  mergeConvertedOverlays(state, converted, props.onPress);
}
