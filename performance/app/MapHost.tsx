import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  MapView,
  Marker,
  type MapProvider,
  type MapViewProps,
  type MapViewRef,
} from 'react-native-better-maps';
import type { CommitSample, PerfMapProps } from '../scenarios/types';
import type { MapHostApi, MountResult } from './runner';

interface HostState {
  key: number;
  props: PerfMapProps | null;
  provider: MapProvider;
}

interface PendingCommit {
  startedAt: number;
  resolve(sample: CommitSample): void;
}

const READY_TIMEOUT_MS = 20_000;

/**
 * Owns the `MapView` the runner drives. Every state update resolves with a
 * `CommitSample` measured from `setState` to the layout effect after the
 * commit, which on the JS thread covers React's render, the Fabric shadow
 * tree commit and Nitro's prop parsing (the JSI object → C++ struct
 * conversion of every descriptor array that changed).
 */
export const MapHost = forwardRef<MapHostApi, { initialProvider: MapProvider }>(
  function MapHost({ initialProvider }, ref) {
    const [state, setState] = useState<HostState>({
      key: 0,
      props: null,
      provider: initialProvider,
    });
    const stateRef = useRef(state);
    stateRef.current = state;
    const mapRef = useRef<MapViewRef>(null);
    const pendingCommit = useRef<PendingCommit | null>(null);
    const readyWaiter = useRef<(() => void) | null>(null);
    const eventCounts = useRef<Record<string, number>>({});

    useLayoutEffect(() => {
      const pending = pendingCommit.current;
      if (pending != null) {
        pendingCommit.current = null;
        const now = performance.now();
        pending.resolve({
          label: '',
          commitMs: now - pending.startedAt,
          committedAt: now,
        });
      }
    }, [state]);

    const commit = useCallback((update: (current: HostState) => HostState) => {
      return new Promise<CommitSample>((resolve) => {
        pendingCommit.current = { startedAt: performance.now(), resolve };
        setState(update);
      });
    }, []);

    const count = useCallback((name: string) => {
      eventCounts.current[name] = (eventCounts.current[name] ?? 0) + 1;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        async mount(props, provider): Promise<MountResult> {
          const mountedAt = performance.now();
          const ready = new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => resolve(true), READY_TIMEOUT_MS);
            readyWaiter.current = () => {
              clearTimeout(timeout);
              resolve(false);
            };
          });
          const sample = await commit((current) => ({
            key: current.key + 1,
            props,
            provider: provider as MapProvider,
          }));
          const timedOut = await ready;
          return {
            commitMs: sample.commitMs,
            readyMs: performance.now() - mountedAt,
            timedOut,
          };
        },
        setProps(patch) {
          return commit((current) => ({
            ...current,
            props:
              current.props == null
                ? current.props
                : { ...current.props, ...patch },
          }));
        },
        async unmount() {
          readyWaiter.current = null;
          if (stateRef.current.props == null) {
            return;
          }
          await commit((current) => ({ ...current, props: null }));
        },
        map: () => mapRef.current,
        takeEventCounts() {
          const counts = eventCounts.current;
          eventCounts.current = {};
          return counts;
        },
      }),
      [commit],
    );

    const onMapReady = useCallback(() => {
      count('onMapReady');
      readyWaiter.current?.();
      readyWaiter.current = null;
    }, [count]);
    const onRegionChange = useCallback(() => count('onRegionChange'), [count]);
    const onRegionChangeComplete = useCallback(
      () => count('onRegionChangeComplete'),
      [count],
    );
    const onMarkerPress = useCallback(() => count('onMarkerPress'), [count]);

    const { props, provider, key } = state;
    if (props == null) {
      return <View style={styles.fill} />;
    }

    const mapProps = {
      provider,
      region: props.region,
      markers: props.markers,
      polylines: props.polylines,
      polygons: props.polygons,
      circles: props.circles,
      clusteringEnabled: props.clusteringEnabled,
      markerEnteringAnimation: props.markerEnteringAnimation,
      onMapReady,
      onRegionChange,
      onRegionChangeComplete,
      onMarkerPress,
    } as MapViewProps;

    return (
      <View style={styles.fill}>
        <MapView key={key} ref={mapRef} style={styles.fill} {...mapProps}>
          {props.markerChildren?.map((marker) => (
            <Marker
              key={marker.id}
              id={marker.id}
              coordinate={marker.coordinate}
              title={marker.title}
              subtitle={marker.subtitle}
            />
          ))}
        </MapView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
