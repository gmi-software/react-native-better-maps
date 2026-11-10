import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  MarkerView,
  type MarkerViewCluster,
  type RenderMarkerViewCluster,
} from 'react-native-better-maps';
import type { LivePlace, MapScenario } from './types';

export const LIVE_MARKERS_SCENARIO_ID = 'live-markers';

const CENTER = { latitude: 52.2297, longitude: 21.0122 };
const PLACE_COUNT = 120;

/** Deterministic spread around the center, so every run shows the same map. */
function makePlaces(): LivePlace[] {
  const places: LivePlace[] = [];
  for (let index = 0; index < PLACE_COUNT; index += 1) {
    const angle = index * 2.399963; // golden angle
    const radius = 0.004 * Math.sqrt(index + 1);
    places.push({
      id: `place-${index}`,
      coordinate: {
        latitude: CENTER.latitude + radius * Math.sin(angle),
        longitude: CENTER.longitude + radius * 1.6 * Math.cos(angle),
      },
      price: 80 + ((index * 37) % 420),
      // Every few places has a live animation, to keep animated hosts on screen.
      isHot: index % 7 === 0,
    });
  }
  return places;
}

export const liveMarkersScenario: MapScenario = {
  id: LIVE_MARKERS_SCENARIO_ID,
  name: 'Live JSX markers',
  description:
    'MarkerView price bubbles with Pressable and Reanimated, clustered natively, JSX cluster badges',
  region: {
    ...CENTER,
    latitudeDelta: 0.09,
    longitudeDelta: 0.11,
  },
  advanced: {
    clusteringEnabled: true,
  },
  livePlaces: makePlaces(),
};

/** Direct `MapView` children: one `MarkerView` per place. */
export function liveMarkerChildren(
  places: LivePlace[],
  onPressPlace: (label: string) => void,
): ReactNode {
  return places.map((place) => (
    <MarkerView
      key={place.id}
      coordinate={place.coordinate}
      width={BUBBLE_WIDTH}
      height={BUBBLE_HEIGHT}
      anchor={BUBBLE_ANCHOR}
    >
      <PriceBubble place={place} onPress={onPressPlace} />
    </MarkerView>
  ));
}

export const renderLiveCluster: RenderMarkerViewCluster = (cluster) => (
  <MarkerView
    coordinate={cluster.coordinate}
    width={CLUSTER_SIZE}
    height={CLUSTER_SIZE}
    anchor={CLUSTER_ANCHOR}
  >
    <ClusterBubble cluster={cluster} />
  </MarkerView>
);

const BUBBLE_WIDTH = 76;
const BUBBLE_HEIGHT = 40;
const BUBBLE_ANCHOR = { x: 0.5, y: 1 };
const CLUSTER_SIZE = 52;
const CLUSTER_ANCHOR = { x: 0.5, y: 0.5 };

function PriceBubble({
  place,
  onPress,
}: {
  place: LivePlace;
  onPress: (label: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onPress(`${place.id} · ${place.price} zł`)}
      onLongPress={() => onPress(`Long press · ${place.id}`)}
      style={styles.bubbleHitArea}
    >
      {({ pressed }) => (
        <View style={[styles.bubble, pressed && styles.bubblePressed]}>
          {place.isHot ? <Pulse /> : null}
          <Text style={styles.bubbleText}>{place.price} zł</Text>
        </View>
      )}
    </Pressable>
  );
}

/** A transform-only loop: Reanimated runs it on the UI thread, no React renders. */
function Pulse() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.6, { duration: 900, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(scale);
  }, [scale]);
  const style = useAnimatedStyle(() => ({
    opacity: 2 - scale.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={[styles.pulse, style]} />;
}

function ClusterBubble({ cluster }: { cluster: MarkerViewCluster }) {
  return (
    <Pressable
      onPress={() => {
        cluster.onPress().catch(() => {});
      }}
      style={({ pressed }) => [styles.cluster, pressed && styles.bubblePressed]}
    >
      <Text style={styles.clusterCount}>{cluster.count}</Text>
      <Text style={styles.clusterLabel}>places</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubbleHitArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bubble: {
    minWidth: 60,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  bubblePressed: {
    backgroundColor: '#1F6FEB',
  },
  bubbleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  pulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 99, 71, 0.45)',
  },
  cluster: {
    width: CLUSTER_SIZE,
    height: CLUSTER_SIZE,
    borderRadius: CLUSTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  clusterCount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clusterLabel: {
    fontSize: 9,
    color: '#D1D5DB',
  },
});
