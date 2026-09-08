import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type Ref,
  type RefObject,
} from 'react';
import { useCollectedOverlays } from '../hooks/useCollectedOverlays';
import { useNitroCallback } from '../hooks/useNitroCallback';
import { useStableValue } from '../hooks/useStableValue';
import {
  MarkerCollection,
  markerCollectionInternals,
} from '../markers/MarkerCollection';
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
import { resolveMapProvider } from '../providers';
import type { Coordinate } from '../types/coordinate';
import type { MapViewProps, PoiPressEvent } from '../types/map';
import type { MapViewRef } from '../types/ref';
import { normalizeEnteringAnimation } from '../utils/enteringAnimation';
import {
  camerasEqual,
  edgePaddingsEqual,
  regionsEqual,
} from '../utils/mapValueEquality';

const MAP_VIEW_NOT_MOUNTED_ERROR = 'MapView is not mounted';

let didWarnAboutIgnoredMarkers = false;

function warnOnceAboutIgnoredMarkers(): void {
  if (didWarnAboutIgnoredMarkers) {
    return;
  }
  didWarnAboutIgnoredMarkers = true;
  console.warn(
    'MapView: `markers` and <Marker> children are ignored while `markerCollection` is set. ' +
      'Put those markers into the collection instead.',
  );
}

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
  markerCollection: markerCollectionProp,
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
    () =>
      markersProp != null ? normalizeMarkerDescriptors(markersProp) : null,
    [markersProp],
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
    polylinesProp ?? collectedPolylines,
    polylineListsEqual,
  );
  const polygons = useStableValue(
    polygonsProp ?? collectedPolygons,
    polygonListsEqual,
  );
  const circles = useStableValue(
    circlesProp ?? collectedCircles,
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

  // `region`, `camera` and `mapPadding` are usually written inline in JSX. The
  // Google providers answer a new `region` with a camera move, so an
  // equal-but-new object must not reach native.
  const stableRegion = useStableValue(region, regionsEqual);
  const stableCamera = useStableValue(camera, camerasEqual);
  const stableMapPadding = useStableValue(mapPadding, edgePaddingsEqual);

  // `markers` and `<Marker>` children are sugar over a MarkerCollection owned
  // here: the stable array above is compiled to a delta batch after commit,
  // so a new array only ships the markers that changed. A caller-provided
  // collection replaces the sugar entirely.
  const usesMarkerSugar = markerCollectionProp == null;
  const sugarCollection = useMemo(
    () => (usesMarkerSugar ? new MarkerCollection() : null),
    [usesMarkerSugar],
  );
  useLayoutEffect(() => {
    if (sugarCollection != null) {
      markerCollectionInternals(sugarCollection).setNormalized(markers);
    }
  }, [markers, sugarCollection]);
  useEffect(
    () => () => {
      sugarCollection?.clear();
    },
    [sugarCollection],
  );
  if (__DEV__ && markerCollectionProp != null && markers.length > 0) {
    warnOnceAboutIgnoredMarkers();
  }
  const activeCollection = markerCollectionProp ?? sugarCollection;
  const nativeMarkerCollection =
    activeCollection != null
      ? markerCollectionInternals(activeCollection).native
      : undefined;

  const hasMarkerPress = onMarkerPressProp != null || hasCollectedMarkerPress;
  const hasMarkerDragEnd =
    onMarkerDragEndProp != null || hasCollectedMarkerDragEnd;
  const hasPolylinePressHandler =
    onPolylinePressProp != null || hasPolylinePress;
  const hasPolygonPressHandler = onPolygonPressProp != null || hasPolygonPress;
  const hasCirclePressHandler = onCirclePressProp != null || hasCirclePress;
  const onPoiPressCallback = onPoiPress as
    ((event: PoiPressEvent) => void) | undefined;

  const handleHybridRef = useCallback((nativeRef: NativeMapViewHybrid) => {
    hybridRef.current = nativeRef;
  }, []);

  const handleMarkerPress = useCallback(
    (id: string) => {
      callbackRegistry.current
        .get(overlayCallbackKey(OverlayType.Marker, id))
        ?.onPress?.();
      onMarkerPressProp?.(id);
    },
    [callbackRegistry, onMarkerPressProp],
  );

  const handleMarkerDragEnd = useCallback(
    (id: string, coordinate: Coordinate) => {
      callbackRegistry.current
        .get(overlayCallbackKey(OverlayType.Marker, id))
        ?.onDragEnd?.(coordinate);
      onMarkerDragEndProp?.(id, coordinate);
    },
    [callbackRegistry, onMarkerDragEndProp],
  );

  const handlePolylinePress = useCallback(
    (id: string) => {
      callbackRegistry.current
        .get(overlayCallbackKey(OverlayType.Polyline, id))
        ?.onPress?.();
      onPolylinePressProp?.(id);
    },
    [callbackRegistry, onPolylinePressProp],
  );

  const handlePolygonPress = useCallback(
    (id: string) => {
      callbackRegistry.current
        .get(overlayCallbackKey(OverlayType.Polygon, id))
        ?.onPress?.();
      onPolygonPressProp?.(id);
    },
    [callbackRegistry, onPolygonPressProp],
  );

  const handleCirclePress = useCallback(
    (id: string) => {
      callbackRegistry.current
        .get(overlayCallbackKey(OverlayType.Circle, id))
        ?.onPress?.();
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

      if (
        event.provider === 'google' &&
        event.name != null &&
        event.placeId != null
      ) {
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
      getClusterMembers: (clusterId) =>
        withHybridRef(hybridRef, (hybrid) =>
          hybrid.getClusterMembers(clusterId),
        ),
    }),
    [],
  );

  return (
    <NativeMapView
      key={`${resolvedProvider}:${googleMapId ?? ''}`}
      style={style}
      hybridRef={hybridRefCallback}
      provider={resolvedProvider}
      googleMapId={googleMapId}
      mapType={mapType}
      region={stableRegion}
      camera={stableCamera}
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
      mapPadding={stableMapPadding}
      markerEnteringAnimation={markerEntering}
      clusterEnteringAnimation={clusterEntering}
      markerCollection={nativeMarkerCollection}
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
