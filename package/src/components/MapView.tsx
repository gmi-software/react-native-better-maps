import { MarkerView } from './MarkerView';
import { MapChildrenContext } from './MapChildrenContext';
import { collectMarkerViewEntries } from '../overlays/collectMarkerViews';
import { markerViewRenderStatesEqual } from '../overlays/markerViewRenderState';
import {
  cloneElement,
  isValidElement,
  useState,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
  type RefObject,
} from 'react';
import { callback } from 'react-native-nitro-modules';
import { useCollectedOverlays } from '../hooks/useCollectedOverlays';
import { NativeMapView } from '../native/MapViewNative';
import type {
  MapView as NativeMapViewHybrid,
  NativePoiPressEvent,
  NativeMarkerViewRenderState,
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
  renderCluster,
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
  const markerViewEntries = useMemo(
    () => collectMarkerViewEntries(children),
    [children],
  );
  const [markerViewState, setMarkerViewState] =
    useState<NativeMarkerViewRenderState | null>(null);
  const handleMarkerViewRenderState = useCallback(
    (state: NativeMarkerViewRenderState) => {
      setMarkerViewState((previous) =>
        markerViewRenderStatesEqual(previous, state) ? previous : state,
      );
    },
    [],
  );
  const markerViewRenderCallback = useMemo(
    () => callback(handleMarkerViewRenderState),
    [handleMarkerViewRenderState],
  );
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

  const markers =
    normalizedBulkMarkers != null ? normalizedBulkMarkers : collectedMarkers;
  const nativeMarkers = useMemo(() => {
    if (markerViewEntries.length === 0) return markers;
    const ids = new Set(markers.map((marker) => marker.id));
    const liveDescriptors = markerViewEntries.map(
      ({ markerId, viewId, element }) => {
        if (ids.has(markerId))
          throw new Error(`Duplicate map marker id: ${markerId}`);
        ids.add(markerId);
        return {
          id: markerId,
          customViewId: viewId,
          coordinate: element.props.coordinate,
          clusterable: element.props.clusterable,
        };
      },
    );
    return [...markers, ...liveDescriptors];
  }, [markers, markerViewEntries]);
  const visibleMarkerViews = useMemo(() => {
    const ids = new Set(markerViewState?.markerViewIds);
    return markerViewEntries
      .filter((entry) => ids.has(entry.viewId))
      .map((entry) => entry.element);
  }, [markerViewState, markerViewEntries]);
  const clusterViews = useMemo(() => {
    if (!renderCluster || clusteringEnabled !== true) return [];
    return (markerViewState?.clusters ?? []).map((cluster) => {
      const element = renderCluster({
        id: cluster.id,
        coordinate: cluster.coordinate,
        markerIds: cluster.markerIds,
        count: cluster.markerIds.length,
        onPress: () => {
          onClusterPress?.(cluster.markerIds, cluster.coordinate);
          const bounds = cluster.region;
          const wrap = (longitude: number) =>
            ((((longitude + 180) % 360) + 360) % 360) - 180;
          return withHybridRef(hybridRef, (hybrid) =>
            hybrid.fitToCoordinates(
              [
                {
                  latitude: Math.max(
                    -90,
                    bounds.latitude - bounds.latitudeDelta / 2,
                  ),
                  longitude: wrap(bounds.longitude - bounds.longitudeDelta / 2),
                },
                {
                  latitude: Math.min(
                    90,
                    bounds.latitude + bounds.latitudeDelta / 2,
                  ),
                  longitude: wrap(bounds.longitude + bounds.longitudeDelta / 2),
                },
              ],
              { top: 32, right: 32, bottom: 32, left: 32 },
              true,
            ),
          );
        },
      });
      if (!isValidElement(element) || element.type !== MarkerView) {
        throw new Error('renderCluster must return a MarkerView');
      }
      return cloneElement(element, {
        key: `cluster:${cluster.id}`,
        coordinate: cluster.coordinate,
      });
    });
  }, [renderCluster, clusteringEnabled, markerViewState, onClusterPress]);

  const polylines = polylinesProp != null ? polylinesProp : collectedPolylines;
  const polygons = polygonsProp != null ? polygonsProp : collectedPolygons;
  const circles = circlesProp != null ? circlesProp : collectedCircles;

  const hasMarkerPress = onMarkerPressProp != null || hasCollectedMarkerPress;
  const hasMarkerDragEnd =
    onMarkerDragEndProp != null || hasCollectedMarkerDragEnd;
  const hasPolylinePressHandler =
    onPolylinePressProp != null || hasPolylinePress;
  const hasPolygonPressHandler = onPolygonPressProp != null || hasPolygonPress;
  const hasCirclePressHandler = onCirclePressProp != null || hasCirclePress;
  const onPoiPressCallback = onPoiPress as
    ((event: PoiPressEvent) => void) | undefined;

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
    <MapChildrenContext.Provider value={true}>
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
        customClusterViews={renderCluster != null}
        onMarkerViewRenderState={
          markerViewEntries.length > 0 || renderCluster != null
            ? markerViewRenderCallback
            : undefined
        }
        mapPadding={mapPadding}
        markerEnteringAnimation={normalizeEnteringAnimation(
          markerEnteringAnimation,
        )}
        clusterEnteringAnimation={normalizeEnteringAnimation(
          clusterEnteringAnimation,
        )}
        markers={nativeMarkers}
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
        onMarkerPress={hasMarkerPress ? callback(handleMarkerPress) : undefined}
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
      >
        {visibleMarkerViews}
        {clusterViews}
      </NativeMapView>
    </MapChildrenContext.Provider>
  );
}
