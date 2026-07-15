# Hotel carousel custom markers (view-shot workaround)

Copy-paste reference for [issue #34](https://github.com/gmi-software/react-native-better-maps/issues/34).

Native `<Marker><View /></Marker>` is not in the library yet. This pattern works **today** on the current release: rasterize a React Native pin once (normal + focused states), pass the `file://` uri to the existing `image` prop, swap uris on focus. Clustering works out of the box.

**Dependency:** `react-native-view-shot` ^5.1.x (New Architecture). Rebuild the dev client after install (`expo prebuild` + native run).

## Minimal example

```tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import {
  MapView,
  type MapViewRef,
  type MarkerDescriptor,
} from 'react-native-better-maps';

const PIN_WIDTH = 96;
const PIN_HEIGHT = 40;

type Hotel = {
  id: string;
  name: string;
  price: number;
  coordinate: { latitude: number; longitude: number };
};

const HOTELS: Hotel[] = [
  {
    id: '1',
    name: 'Old Town Loft',
    price: 89,
    coordinate: { latitude: 52.2497, longitude: 21.0122 },
  },
  // …more hotels
];

function HotelPin({
  price,
  focused,
}: {
  price: number;
  focused?: boolean;
}) {
  return (
    <View
      style={[
        styles.pin,
        focused ? styles.pinFocused : styles.pinDefault,
      ]}
    >
      <Text style={[styles.pinText, focused && styles.pinTextFocused]}>
        ★ ${price}
      </Text>
    </View>
  );
}

export function HotelMapScreen() {
  const mapRef = useRef<MapViewRef>(null);
  const carouselRef = useRef<ScrollView>(null);
  const normalRefs = useRef<Record<string, View | null>>({});
  const focusedRefs = useRef<Record<string, View | null>>({});
  const captured = useRef(new Set<string>());

  const [focusedId, setFocusedId] = useState(HOTELS[0]?.id ?? '');
  const [uris, setUris] = useState<
    Record<string, { normal: string; focused: string }>
  >({});

  const capture = useCallback(async (id: string, focused: boolean) => {
    const key = `${id}:${focused ? 'f' : 'n'}`;
    if (captured.current.has(key)) return;

    const ref = focused ? focusedRefs.current[id] : normalRefs.current[id];
    if (ref == null) return;

    captured.current.add(key);
    const uri = await captureRef(ref, { format: 'png', result: 'tmpfile' });
    setUris((prev) => ({
      ...prev,
      [id]: {
        normal: focused ? (prev[id]?.normal ?? '') : uri,
        focused: focused ? uri : (prev[id]?.focused ?? ''),
      },
    }));
  }, []);

  const markers = useMemo((): MarkerDescriptor[] => {
    return HOTELS.flatMap((hotel) => {
      const pair = uris[hotel.id];
      if (pair == null || pair.normal === '' || pair.focused === '') {
        return [];
      }

      const focused = focusedId === hotel.id;

      return [
        {
          id: hotel.id,
          coordinate: hotel.coordinate,
          clusterable: true,
          image: {
            uri: focused ? pair.focused : pair.normal,
            width: PIN_WIDTH,
            height: PIN_HEIGHT,
          },
          anchor: { x: 0.5, y: 0.5 },
        },
      ];
    });
  }, [focusedId, uris]);

  const focusHotel = useCallback((id: string, scrollCarousel: boolean) => {
    const index = HOTELS.findIndex((h) => h.id === id);
    if (index < 0) return;

    setFocusedId(id);

    if (scrollCarousel) {
      carouselRef.current?.scrollTo({ x: index * 280, animated: true });
    }

    mapRef.current?.animateCamera(
      { center: HOTELS[index].coordinate, zoom: 15 },
      0.35,
    );
  }, []);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        clusteringEnabled
        markers={markers}
        onMarkerPress={(id) => focusHotel(id, true)}
      />

      <ScrollView
        ref={carouselRef}
        horizontal
        snapToInterval={280}
        decelerationRate="fast"
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / 280);
          const hotel = HOTELS[index];
          if (hotel != null) focusHotel(hotel.id, false);
        }}
        style={styles.carousel}
      >
        {HOTELS.map((hotel) => (
          <View key={hotel.id} style={styles.card}>
            <Text>{hotel.name}</Text>
            <Text>${hotel.price}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Off-screen rasterizer — collapsable={false} required on Android */}
      <View style={styles.offscreen} pointerEvents="none">
        {HOTELS.map((hotel) => (
          <View key={hotel.id} style={{ flexDirection: 'row', gap: 8 }}>
            <View
              ref={(n) => {
                normalRefs.current[hotel.id] = n;
              }}
              collapsable={false}
              onLayout={() => {
                requestAnimationFrame(() => {
                  void capture(hotel.id, false);
                });
              }}
            >
              <HotelPin price={hotel.price} />
            </View>
            <View
              ref={(n) => {
                focusedRefs.current[hotel.id] = n;
              }}
              collapsable={false}
              onLayout={() => {
                requestAnimationFrame(() => {
                  void capture(hotel.id, true);
                });
              }}
            >
              <HotelPin price={hotel.price} focused />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  carousel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: 140,
  },
  card: {
    width: 260,
    marginHorizontal: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  offscreen: { position: 'absolute', left: -10_000, top: 0 },
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  pinDefault: { backgroundColor: '#fff', borderColor: '#e5e5ea' },
  pinFocused: { backgroundColor: '#e53935', borderColor: '#c62828' },
  pinText: { fontWeight: '700', color: '#1c1c1e' },
  pinTextFocused: { color: '#fff' },
});
```

## Notes

- Capture **both** normal and focused states once up front; focus changes are a cheap `image.uri` swap (no per-frame re-render).
- Pass explicit `width` / `height` (dp) on `image` so anchor math stays stable.
- `clusteringEnabled` on `MapView` + `clusterable: true` on each marker — works with bitmap icons today.
- Full working demo in this repo: tap **Hotel carousel** in the example app dock (`example/HotelCarouselExample.tsx`).

## Planned native API

We are exploring first-class support:

```tsx
<Marker coordinate={hotel.coord} clusterable>
  <HotelPin label={hotel.price} focused={focusedId === hotel.id} />
</Marker>
```

Same mental model, snapshot handled inside the library (no view-shot, no temp files).
