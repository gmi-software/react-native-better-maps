import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapView, MarkerView } from 'react-native-better-maps';

const CENTER = { latitude: 52.2297, longitude: 21.0122 };
const CAMERA = { center: CENTER, zoom: 14, pitch: 0, heading: 0 };

type Counts = { in: number; out: number; press: number; long: number };
const emptyCounts = (): Counts => ({ in: 0, out: 0, press: 0, long: 0 });

function TouchTarget({
  label,
  onMeasurement,
}: {
  label: string;
  onMeasurement: (message: string) => void;
}) {
  const ref = useRef<View>(null);
  const [counts, setCounts] = useState(emptyCounts);

  return (
    <Pressable
      ref={ref}
      accessibilityLabel={`${label}: ${counts.press} taps, ${counts.long} long presses`}
      onPressIn={(event) => {
        setCounts((value) => ({ ...value, in: value.in + 1 }));
        const { pageX, pageY } = event.nativeEvent;
        ref.current?.measure((_x, _y, width, height, measuredX, measuredY) => {
          const inside =
            pageX >= measuredX &&
            pageX < measuredX + width &&
            pageY >= measuredY &&
            pageY < measuredY + height;
          onMeasurement(
            `${label}: touch ${pageX.toFixed(1)},${pageY.toFixed(1)}; ` +
              `measure ${measuredX.toFixed(1)},${measuredY.toFixed(1)} ` +
              `${width.toFixed(1)}×${height.toFixed(1)}; inside=${inside}`,
          );
        });
      }}
      onPressOut={() =>
        setCounts((value) => ({ ...value, out: value.out + 1 }))
      }
      onPress={() =>
        setCounts((value) => ({ ...value, press: value.press + 1 }))
      }
      onLongPress={() =>
        setCounts((value) => ({ ...value, long: value.long + 1 }))
      }
      style={styles.target}
    >
      <Text style={styles.targetText}>{label}</Text>
      <Text style={styles.countText}>
        in {counts.in} · out {counts.out} · tap {counts.press} · long{' '}
        {counts.long}
      </Text>
    </Pressable>
  );
}

export default function MarkerTouchCheck() {
  const [mounted, setMounted] = useState(true);
  const [mapPresses, setMapPresses] = useState(0);
  const [measurement, setMeasurement] = useState(
    'Tap, hold, and drag outside each marker.',
  );

  return (
    <View style={styles.root}>
      {mounted && (
        <MapView
          provider={Platform.OS === 'ios' ? 'apple' : 'google'}
          style={styles.map}
          camera={CAMERA}
          markerEnteringAnimation={false}
          onPress={() => setMapPresses((value) => value + 1)}
        >
          <MarkerView
            id="touch-direct"
            coordinate={{ ...CENTER, latitude: CENTER.latitude + 0.003 }}
            width={160}
            height={60}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <TouchTarget label="Direct marker" onMeasurement={setMeasurement} />
          </MarkerView>
          <MarkerView
            id="touch-nested"
            coordinate={CENTER}
            width={184}
            height={84}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.nestedHost}>
              <TouchTarget
                label="Nested marker"
                onMeasurement={setMeasurement}
              />
            </View>
          </MarkerView>
        </MapView>
      )}
      <View style={styles.panel}>
        <Text testID="marker-touch-measurement">{measurement}</Text>
        <Text>
          Map presses {mapPresses}. Pan the map, then repeat the touches.
        </Text>
        <Pressable
          accessibilityLabel="Toggle marker map mount"
          onPress={() => setMounted((value) => !value)}
          style={styles.button}
        >
          <Text>{mounted ? 'Unmount' : 'Mount'} map</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  panel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 36,
    padding: 12,
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  button: {
    alignSelf: 'flex-start',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
  },
  nestedHost: {
    width: 184,
    height: 84,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fde68a',
  },
  target: {
    width: 160,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1d4ed8',
    backgroundColor: '#dbeafe',
  },
  targetText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  countText: { fontSize: 11, color: '#111827' },
});
