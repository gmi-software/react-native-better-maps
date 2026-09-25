import {
  useCallback,
  useImperativeHandle,
  useMemo,
  type Ref,
} from 'react';
import { runWithValidCamera } from '../camera/runWithValidCamera';
import { useValidCamera } from '../camera/useValidCamera';
import { useCollectedOverlays } from '../hooks/useCollectedOverlays';
import { useMapViewCommands } from '../hooks/useMapViewCommands';
import { useNitroCallback } from '../hooks/useNitroCallback';
import { useStableValue } from '../hooks/useStableValue';
import { NativeMapView } from '../native/MapViewNative';
import type {
  MapView as NativeMapViewHybrid,
  NativePoiPressEvent,
} from '../native/specs/MapView.nitro';
import {
  circleListsEqual,
  enteringAnimationsEqual,
  markerListsEqual,
  polygonListsEqual,
  polylineListsEqual,
} from '../overlays/descriptorEquality';
import { OverlayType, overlayCallbackKey } from '../overlays/overlayType';
import { normalizeMarkerDescriptors } from '../overlays/normalizeMarkerDescriptors';
import {
  normalizeCircleDescriptors,
  normalizePolygonDescriptors,
  normalizePolylineDescriptors,
} from '../overlays/normalizeShapeDescriptors';
import {
  runWithValidCoordinate,
  runWithValidPoint,
} from '../projection/runWithValidInput';
import { resolveMapProvider } from '../providers';
import { resolveFitCoordinates } from '../region/resolveFitCoordinates';
import { useValidRegion } from '../region/useValidRegion';
import type { Coordinate } from '../types/coordinate';
import type { MapViewProps, PoiPressEvent } from '../types/map';
import type { MapViewRef } from '../types/ref';
import { normalizeEnteringAnimation } from '../utils/enteringAnimation';

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
  applePoiDetailPresentation,
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
  // Both are creation-time SDK configuration, so changing either remounts the
  // native view.
  const nativeViewKey = `${resolvedProvider}:${googleMapId ?? ''}`;
  const commands = useMapViewCommands(nativeViewKey);
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
    () =>
      markersProp != null ? normalizeMarkerDescriptors(markersProp) : null,
    [markersProp],
  );
  const normalizedBulkPolylines = useMemo(
    () =>
      polylinesProp != null
        ? normalizePolylineDescriptors(polylinesProp)
        : null,
    [polylinesProp],
  );
  const normalizedBulkPolygons = useMemo(
    () =>
      polygonsProp != null ? normalizePolygonDescriptors(polygonsProp) : null,
    [polygonsProp],
  );
  const normalizedBulkCircles = useMemo(
    () =>
      circlesProp != null ? normalizeCircleDescriptors(circlesProp) : null,
    [circlesProp],
  );

  // Everything below is rebuilt whenever `children`, a bulk prop or an animation
  // prop changes identity - which for inline JSX is every render. Nitro would
  // re-serialize each one across JSI, so hand back the previous value when
  // nothing actually changed.
  const markers = useStableValue(
    normalizedBulkMarkers ?? collectedMarkers,
    markerListsEqual,
  );
  const polylines = useStableValue(
    normalizedBulkPolylines ?? collectedPolylines,
    polylineListsEqual,
  );
  const polygons = useStableValue(
    normalizedBulkPolygons ?? collectedPolygons,
    polygonListsEqual,
  );
  const circles = useStableValue(
    normalizedBulkCircles ?? collectedCircles,
    circleListsEqual,
  );
  const markerEntering = useStableValue(
    normalizeEnteringAnimation(markerEnteringAnimation),
    enteringAnimationsEqual,
  );
  const clusterEntering = useStableValue(
    normalizeEnteringAnimation(clusterEnteringAnimation),
    enteringAnimationsEqual,
  );
  const validRegion = useValidRegion(region);
  const validCamera = useValidCamera(camera);

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

  const handleHybridRef = useCallback(
    (nativeRef: NativeMapViewHybrid) => {
      commands.attach(nativeRef);
    },
    [commands],
  );

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

  // Nitro's `callback(...)` envelope is a fresh object per call, so each of
  // these is memoized on the handler it wraps. An inline arrow passed by the
  // caller still changes identity every render - that part is theirs to hoist.
  const hybridRefCallback = useNitroCallback(handleHybridRef);
  const onRegionChangeCallback = useNitroCallback(onRegionChange);
  const onRegionChangeCompleteCallback = useNitroCallback(
    onRegionChangeComplete,
  );
  const onMapReadyCallback = useNitroCallback(onMapReady);
  const onPressCallback = useNitroCallback(onPress);
  const onPoiPressNativeCallback = useNitroCallback(
    onPoiPress == null ? undefined : handlePoiPress,
  );
  const onLongPressCallback = useNitroCallback(onLongPress);
  const onClusterPressCallback = useNitroCallback(onClusterPress);
  const onMarkerPressCallback = useNitroCallback(
    hasMarkerPress ? handleMarkerPress : undefined,
  );
  const onMarkerDragEndCallback = useNitroCallback(
    hasMarkerDragEnd ? handleMarkerDragEnd : undefined,
  );
  const onPolylinePressCallback = useNitroCallback(
    hasPolylinePressHandler ? handlePolylinePress : undefined,
  );
  const onPolygonPressCallback = useNitroCallback(
    hasPolygonPressHandler ? handlePolygonPress : undefined,
  );
  const onCirclePressCallback = useNitroCallback(
    hasCirclePressHandler ? handleCirclePress : undefined,
  );

  useImperativeHandle(
    ref,
    () => ({
      getCamera: () => commands.run((hybrid) => hybrid.fetchCamera()),
      setCamera: (nextCamera) =>
        runWithValidCamera(nextCamera, () =>
          commands.run((hybrid) => hybrid.applyCamera(nextCamera)),
        ),
      animateCamera: (nextCamera, duration) =>
        runWithValidCamera(nextCamera, () =>
          commands.run((hybrid) => hybrid.animateCamera(nextCamera, duration)),
        ),
      getVisibleRegion: () =>
        commands.run((hybrid) => hybrid.getVisibleRegion()),
      fitToCoordinates: (coordinates, padding, animated) =>
        commands.run((hybrid) =>
          hybrid.fitToCoordinates(
            resolveFitCoordinates(coordinates),
            padding,
            animated,
          ),
        ),
      pointForCoordinate: (coordinate) =>
        runWithValidCoordinate(coordinate, () =>
          commands.run((hybrid) => hybrid.pointForCoordinate(coordinate)),
        ),
      coordinateForPoint: (point) =>
        runWithValidPoint(point, () =>
          commands.run((hybrid) => hybrid.coordinateForPoint(point)),
        ),
    }),
    [commands],
  );

  return (
    <NativeMapView
      key={nativeViewKey}
      style={style}
      hybridRef={hybridRefCallback}
      provider={resolvedProvider}
      googleMapId={googleMapId}
      mapType={mapType}
      region={validRegion}
      camera={validCamera}
      scrollEnabled={scrollEnabled}
      zoomEnabled={zoomEnabled}
      rotateEnabled={rotateEnabled}
      pitchEnabled={pitchEnabled}
      showsUserLocation={showsUserLocation}
      followsUserLocation={followsUserLocation}
      showsCompass={showsCompass}
      showsScale={showsScale}
      applePoiDetailPresentation={applePoiDetailPresentation}
      customMapStyle={customMapStyle}
      clusteringEnabled={clusteringEnabled}
      mapPadding={mapPadding}
      markerEnteringAnimation={markerEntering}
      clusterEnteringAnimation={clusterEntering}
      markers={markers}
      polylines={polylines}
      polygons={polygons}
      circles={circles}
      onRegionChange={onRegionChangeCallback}
      onRegionChangeComplete={onRegionChangeCompleteCallback}
      onMapReady={onMapReadyCallback}
      onPress={onPressCallback}
      onPoiPress={onPoiPressNativeCallback}
      onLongPress={onLongPressCallback}
      onClusterPress={onClusterPressCallback}
      onMarkerPress={onMarkerPressCallback}
      onMarkerDragEnd={onMarkerDragEndCallback}
      onPolylinePress={onPolylinePressCallback}
      onPolygonPress={onPolygonPressCallback}
      onCirclePress={onCirclePressCallback}
    />
  );
}
