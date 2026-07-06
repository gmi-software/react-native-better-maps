import { useCallback, useImperativeHandle, useMemo, useRef, type Ref, type RefObject } from 'react';
import { callback } from 'react-native-nitro-modules';
import { useCollectedOverlays } from '../hooks/useCollectedOverlays';
import { NativeMapView } from '../native/MapViewNative';
import type {
  MapView as NativeMapViewHybrid,
  NativePoiPressEvent,
} from '../native/specs/MapView.nitro';
import { OverlayType, overlayCallbackKey } from '../overlays/overlayType';
import { normalizeMarkerDescriptors } from '../overlays/normalizeMarkerDescriptors';
import { resolveMapProvider } from '../providers';
import type { Coordinate } from '../types/coordinate';
import type { MapViewProps, PoiPressEvent } from '../types/map';
import type { MapViewRef } from '../types/ref';
import { normalizeEnteringAnimation } from '../utils/enteringAnimation';

const MAP_VIEW_NOT_MOUNTED_ERROR = 'MapView is not mounted';

function withHybridRef<T>(
  hybridRef: RefObject<NativeMapViewHybrid | null>,
  run: (hybrid: NativeMapViewHybrid) => T,
): T {
  const hybrid = hybridRef.current;
  if (hybrid == null) {
    return Promise.reject(new Error(MAP_VIEW_NOT_MOUNTED_ERROR)) as T;
  }

  return run(hybrid);
}

export function MapView({
  ref,
  style,
  children,
  provider,
  googleMapId,
  region,
  camera,
  mapType = 'standard',
  scrollEnabled,
  zoomEnabled,
  rotateEnabled,
  pitchEnabled,
  showsUserLocation,
  followsUserLocation,
  showsCompass,
  showsScale,
  customMapStyle,
  clusteringEnabled,
  mapPadding,
  markerEnteringAnimation,
  clusterEnteringAnimation,
  markers: markersProp,
  polylines: polylinesProp,
  polygons: polygonsProp,
  circles: circlesProp,
  onRegionChange,
  onRegionChangeComplete,
  onMapReady,
  onPress,
  onPoiPress,
  onLongPress,
  onClusterPress,
  onMarkerPress: onMarkerPressProp,
  onMarkerDragEnd: onMarkerDragEndProp,
  onPolylinePress: onPolylinePressProp,
  onPolygonPress: onPolygonPressProp,
  onCirclePress: onCirclePressProp,
}: MapViewProps & { ref?: Ref<MapViewRef> }) {
  const resolvedProvider = resolveMapProvider(provider);
  const hybridRef = useRef<NativeMapViewHybrid>(null);
  const {
    markers: collectedMarkers,
    polylines: collectedPolylines,
    polygons: collectedPolygons,
    circles: collectedCircles,
    callbackRegistry,
    hasMarkerPress: hasCollectedMarkerPress,
    hasMarkerDragEnd: hasCollectedMarkerDragEnd,
    hasPolylinePress,
    hasPolygonPress,
    hasCirclePress,
  } = useCollectedOverlays(children);
  const normalizedBulkMarkers = useMemo(
    () => (markersProp != null ? normalizeMarkerDescriptors(markersProp) : null),
    [markersProp],
  );

  const markers =
    normalizedBulkMarkers != null ? normalizedBulkMarkers : collectedMarkers;
  const polylines =
    polylinesProp != null ? polylinesProp : collectedPolylines;
  const polygons =
    polygonsProp != null ? polygonsProp : collectedPolygons;
  const circles =
    circlesProp != null ? circlesProp : collectedCircles;

  const hasMarkerPress =
    onMarkerPressProp != null || hasCollectedMarkerPress;
  const hasMarkerDragEnd =
    onMarkerDragEndProp != null || hasCollectedMarkerDragEnd;
  const hasPolylinePressHandler =
    onPolylinePressProp != null || hasPolylinePress;
  const hasPolygonPressHandler =
    onPolygonPressProp != null || hasPolygonPress;
  const hasCirclePressHandler =
    onCirclePressProp != null || hasCirclePress;
  const onPoiPressCallback = onPoiPress as
    | ((event: PoiPressEvent) => void)
    | undefined;

  const handleMarkerPress = useCallback(
    (id: string) => {
      callbackRegistry.current.get(overlayCallbackKey(OverlayType.Marker, id))?.onPress?.();
      onMarkerPressProp?.(id);
    },
    [callbackRegistry, onMarkerPressProp],
  );

  const handleMarkerDragEnd = useCallback(
    (id: string, coordinate: Coordinate) => {
      callbackRegistry.current.get(overlayCallbackKey(OverlayType.Marker, id))?.onDragEnd?.(coordinate);
      onMarkerDragEndProp?.(id, coordinate);
    },
    [callbackRegistry, onMarkerDragEndProp],
  );

  const handlePolylinePress = useCallback(
    (id: string) => {
      callbackRegistry.current.get(overlayCallbackKey(OverlayType.Polyline, id))?.onPress?.();
      onPolylinePressProp?.(id);
    },
    [callbackRegistry, onPolylinePressProp],
  );

  const handlePolygonPress = useCallback(
    (id: string) => {
      callbackRegistry.current.get(overlayCallbackKey(OverlayType.Polygon, id))?.onPress?.();
      onPolygonPressProp?.(id);
    },
    [callbackRegistry, onPolygonPressProp],
  );

  const handleCirclePress = useCallback(
    (id: string) => {
      callbackRegistry.current.get(overlayCallbackKey(OverlayType.Circle, id))?.onPress?.();
      onCirclePressProp?.(id);
    },
    [callbackRegistry, onCirclePressProp],
  );

  const handlePoiPress = useCallback(
    (event: NativePoiPressEvent) => {
      if (event.provider === 'apple') {
        const poiEvent: PoiPressEvent = {
          provider: 'apple',
          coordinate: event.coordinate,
          name: event.name,
          category: event.category ?? 'unknown',
          rawCategory: event.rawCategory,
        };
        onPoiPressCallback?.(poiEvent);
        return;
      }

      if (event.provider === 'google' && event.name != null && event.placeId != null) {
        const poiEvent: PoiPressEvent = {
          provider: 'google',
          coordinate: event.coordinate,
          name: event.name,
          placeId: event.placeId,
        };
        onPoiPressCallback?.(poiEvent);
      }
    },
    [onPoiPressCallback],
  );

  useImperativeHandle(
    ref,
    () => ({
      getCamera: () =>
        withHybridRef(hybridRef, (hybrid) => hybrid.fetchCamera()),
      setCamera: (nextCamera) =>
        withHybridRef(hybridRef, (hybrid) => hybrid.applyCamera(nextCamera)),
      animateCamera: (nextCamera, duration) =>
        withHybridRef(hybridRef, (hybrid) =>
          hybrid.animateCamera(nextCamera, duration),
        ),
      getVisibleRegion: () =>
        withHybridRef(hybridRef, (hybrid) => hybrid.getVisibleRegion()),
      fitToCoordinates: (coordinates, padding, animated) =>
        withHybridRef(hybridRef, (hybrid) =>
          hybrid.fitToCoordinates(coordinates, padding, animated),
        ),
    }),
    [],
  );

  return (
    <NativeMapView
      key={`${resolvedProvider}:${googleMapId ?? ''}`}
      style={style}
      hybridRef={callback((nativeRef) => {
        hybridRef.current = nativeRef;
      })}
      provider={resolvedProvider}
      googleMapId={googleMapId}
      mapType={mapType}
      region={region}
      camera={camera}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      showsUserLocation={showsUserLocation}
      followsUserLocation={followsUserLocation}
      showsCompass={showsCompass}
      showsScale={showsScale}
      customMapStyle={customMapStyle}
      clusteringEnabled={clusteringEnabled}
      mapPadding={mapPadding}
      markerEnteringAnimation={normalizeEnteringAnimation(markerEnteringAnimation)}
      clusterEnteringAnimation={normalizeEnteringAnimation(clusterEnteringAnimation)}
      markers={markers}
      polylines={polylines}
      polygons={polygons}
      circles={circles}
      onRegionChange={
        onRegionChange == null ? undefined : callback(onRegionChange)
      }
      onRegionChangeComplete={
        onRegionChangeComplete == null
          ? undefined
          : callback(onRegionChangeComplete)
      }
      onMapReady={onMapReady == null ? undefined : callback(onMapReady)}
      onPress={onPress == null ? undefined : callback(onPress)}
      onPoiPress={onPoiPress == null ? undefined : callback(handlePoiPress)}
      onLongPress={onLongPress == null ? undefined : callback(onLongPress)}
      onClusterPress={
        onClusterPress == null ? undefined : callback(onClusterPress)
      }
      onMarkerPress={
        hasMarkerPress ? callback(handleMarkerPress) : undefined
      }
      onMarkerDragEnd={
        hasMarkerDragEnd ? callback(handleMarkerDragEnd) : undefined
      }
      onPolylinePress={
        hasPolylinePressHandler ? callback(handlePolylinePress) : undefined
      }
      onPolygonPress={
        hasPolygonPressHandler ? callback(handlePolygonPress) : undefined
      }
      onCirclePress={
        hasCirclePressHandler ? callback(handleCirclePress) : undefined
      }
    />
  );
}
