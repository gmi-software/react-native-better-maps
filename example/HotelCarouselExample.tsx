import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {
  FlatList,
  Pressable,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import ViewShot, { releaseCapture } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import {
  MapView,
  type Camera,
  type MapViewRef,
  type MarkerDescriptor,
} from 'react-native-better-maps';
import {
  HOTEL_PIN_HEIGHT,
  HOTEL_PIN_WIDTH,
  HotelPin,
} from './HotelPin';
import { HOTELS, HOTEL_MAP_REGION, type Hotel } from './examples/hotels';

const CARD_GAP = 12;
const CAROUSEL_HEIGHT = 148;
const MAP_PROVIDER = Platform.OS === 'android' ? 'google' : 'apple';
const CAPTURE_TIMEOUT_MS = 8_000;
const FOCUS_ZOOM = 15;
/** MapView.animateCamera duration is in seconds, not milliseconds. */
const CAMERA_ANIMATION_SECONDS = 0.35;
const HOTEL_COUNT = HOTELS.length;
const EXPECTED_CAPTURE_COUNT = HOTEL_COUNT * 2;

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<Hotel>);

type PinUriPair = {
  normal: string;
  focused: string;
};

type CaptureTarget = 'normal' | 'focused';

type HotelCarouselExampleProps = {
  onClose: () => void;
};

type CarouselLayout = {
  cardWidth: number;
  snapInterval: number;
  sideInset: number;
};

function captureKey(hotelId: string, target: CaptureTarget): string {
  return `${hotelId}:${target}`;
}

function carouselIndexFromOffset(offsetX: number, snapInterval: number): number {
  'worklet';
  return Math.min(
    HOTEL_COUNT - 1,
    Math.max(0, Math.round(offsetX / snapInterval)),
  );
}

type PinCaptureProps = {
  hotelId: string;
  target: CaptureTarget;
  price: number;
  category: Hotel['category'];
  focused: boolean;
  onCaptured: (hotelId: string, target: CaptureTarget, uri: string) => void;
};

function PinCapture({
  hotelId,
  target,
  price,
  category,
  focused,
  onCaptured,
}: PinCaptureProps) {
  const capturedRef = useRef(false);

  const handleCapture = useCallback(
    (uri: string) => {
      if (capturedRef.current) {
        return;
      }

      capturedRef.current = true;
      onCaptured(hotelId, target, uri);
    },
    [hotelId, onCaptured, target],
  );

  return (
    <View collapsable={false}>
      <ViewShot
        options={{ format: 'png', result: 'tmpfile' }}
        captureMode="mount"
        onCapture={handleCapture}
        onCaptureFailure={(error) => {
          console.warn(`Hotel pin capture failed (${hotelId}:${target})`, error);
        }}
      >
        <HotelPin price={price} category={category} focused={focused} />
      </ViewShot>
    </View>
  );
}

export function HotelCarouselExample({ onClose }: HotelCarouselExampleProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { width: screenWidth } = useWindowDimensions();
  const mapRef = useRef<MapViewRef>(null);
  const carouselRef = useRef<FlatList<Hotel>>(null);
  const captureCompleted = useRef(new Set<string>());
  const pendingPinUris = useRef<Record<string, PinUriPair>>({});
  const capturedUris = useRef<string[]>([]);
  const flushScheduled = useRef(false);

  const [focusedId, setFocusedId] = useState(HOTELS[0]?.id ?? '');
  const [pinUris, setPinUris] = useState<Record<string, PinUriPair>>({});
  const [captureTimedOut, setCaptureTimedOut] = useState(false);

  const carouselLayout = useMemo((): CarouselLayout => {
    const cardWidth = screenWidth * 0.72;
    return {
      cardWidth,
      snapInterval: cardWidth + CARD_GAP,
      sideInset: (screenWidth - cardWidth) / 2,
    };
  }, [screenWidth]);

  const snapIntervalShared = useSharedValue(carouselLayout.snapInterval);

  useEffect(() => {
    snapIntervalShared.value = carouselLayout.snapInterval;
  }, [carouselLayout.snapInterval, snapIntervalShared]);

  const schedulePinUriFlush = useCallback(() => {
    if (flushScheduled.current) {
      return;
    }

    flushScheduled.current = true;
    queueMicrotask(() => {
      flushScheduled.current = false;
      setPinUris({ ...pendingPinUris.current });
    });
  }, []);

  const handlePinCaptured = useCallback(
    (hotelId: string, target: CaptureTarget, uri: string) => {
      const key = captureKey(hotelId, target);
      if (captureCompleted.current.has(key)) {
        return;
      }

      captureCompleted.current.add(key);
      capturedUris.current.push(uri);

      const pair = pendingPinUris.current[hotelId] ?? { normal: '', focused: '' };
      pendingPinUris.current[hotelId] =
        target === 'normal'
          ? { ...pair, normal: uri }
          : { ...pair, focused: uri };

      schedulePinUriFlush();
    },
    [schedulePinUriFlush],
  );

  useEffect(() => {
    return () => {
      for (const uri of capturedUris.current) {
        releaseCapture(uri);
      }
    };
  }, []);

  const markers = useMemo((): MarkerDescriptor[] => {
    return HOTELS.flatMap((hotel) => {
      const uris = pinUris[hotel.id];
      if (uris == null || uris.normal === '' || uris.focused === '') {
        return [];
      }

      const focused = focusedId === hotel.id;

      return [
        {
          id: hotel.id,
          coordinate: hotel.coordinate,
          title: hotel.name,
          subtitle: `$${hotel.price} · ${hotel.category}`,
          clusterable: true,
          image: {
            uri: focused ? uris.focused : uris.normal,
            width: HOTEL_PIN_WIDTH,
            height: HOTEL_PIN_HEIGHT,
          },
          anchor: { x: 0.5, y: 1 },
        },
      ];
    });
  }, [focusedId, pinUris]);

  const pinsReady = markers.length === HOTEL_COUNT;
  const capturedCount = useMemo(() => {
    return Object.values(pinUris).reduce((count, pair) => {
      return count + (pair.normal !== '' ? 1 : 0) + (pair.focused !== '' ? 1 : 0);
    }, 0);
  }, [pinUris]);

  useEffect(() => {
    if (pinsReady) {
      setCaptureTimedOut(false);
      return;
    }

    const timeout = setTimeout(() => {
      setCaptureTimedOut(true);
    }, CAPTURE_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [pinsReady]);

  const moveMapToHotel = useCallback(
    (hotel: Hotel) => {
      const camera: Camera = {
        center: hotel.coordinate,
        zoom: FOCUS_ZOOM,
        heading: 0,
        pitch: 0,
      };

      if (reducedMotion) {
        mapRef.current?.setCamera(camera);
        return;
      }

      mapRef.current?.animateCamera(camera, CAMERA_ANIMATION_SECONDS);
    },
    [reducedMotion],
  );

  const focusHotel = useCallback(
    (hotelId: string, scrollCarousel: boolean) => {
      const index = HOTELS.findIndex((hotel) => hotel.id === hotelId);
      if (index < 0) {
        return;
      }

      const hotel = HOTELS[index];
      setFocusedId(hotel.id);

      if (scrollCarousel) {
        carouselRef.current?.scrollToOffset({
          offset: index * carouselLayout.snapInterval,
          animated: true,
        });
      }

      moveMapToHotel(hotel);
    },
    [carouselLayout.snapInterval, moveMapToHotel],
  );

  const focusHotelByIndex = useCallback(
    (index: number) => {
      const hotel = HOTELS[index];
      if (hotel == null) {
        return;
      }

      focusHotel(hotel.id, false);
    },
    [focusHotel],
  );

  const scrollHandler = useAnimatedScrollHandler({
    onEndDrag: (event) => {
      const index = carouselIndexFromOffset(
        event.contentOffset.x,
        snapIntervalShared.value,
      );
      scheduleOnRN(focusHotelByIndex, index);
    },
    onMomentumEnd: (event) => {
      const index = carouselIndexFromOffset(
        event.contentOffset.x,
        snapIntervalShared.value,
      );
      scheduleOnRN(focusHotelByIndex, index);
    },
  });

  const handleMarkerPress = useCallback(
    (id: string) => {
      focusHotel(id, true);
    },
    [focusHotel],
  );

  const handleMapReady = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      mapRef.current?.fitToCoordinates(
        HOTELS.map((hotel) => hotel.coordinate),
        {
          top: insets.top + 72,
          right: 24,
          bottom: CAROUSEL_HEIGHT + insets.bottom + 24,
          left: 24,
        },
        false,
      );
    });
  }, [insets.bottom, insets.top]);

  const renderCarouselItem = useCallback(
    ({ item }: ListRenderItemInfo<Hotel>) => {
      const selected = focusedId === item.id;

      return (
        <Pressable
          onPress={() => focusHotel(item.id, true)}
          style={[
            styles.card,
            selected && styles.cardSelected,
            {
              width: carouselLayout.cardWidth,
              marginRight: CARD_GAP,
            },
          ]}
        >
          <Text style={styles.cardCategory}>{item.category}</Text>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardPrice}>${item.price} / night</Text>
        </Pressable>
      );
    },
    [carouselLayout.cardWidth, focusHotel, focusedId],
  );

  const getCarouselItemLayout = useCallback(
    (_: ArrayLike<Hotel> | null | undefined, index: number) => ({
      length: carouselLayout.snapInterval,
      offset: carouselLayout.snapInterval * index,
      index,
    }),
    [carouselLayout.snapInterval],
  );

  const statusText = useMemo(() => {
    if (captureTimedOut && !pinsReady) {
      return `Pin capture stalled (${capturedCount}/${EXPECTED_CAPTURE_COUNT}). Rebuild the dev client after adding react-native-view-shot: cd example && bun run prebuild && bun run ios`;
    }

    if (!pinsReady) {
      return `Rasterizing custom pins… (${capturedCount}/${EXPECTED_CAPTURE_COUNT})`;
    }

    return 'Scroll carousel or tap a pin · zoom out to cluster';
  }, [captureTimedOut, capturedCount, pinsReady]);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={MAP_PROVIDER}
        mapType="standard"
        region={HOTEL_MAP_REGION}
        clusteringEnabled
        mapPadding={{
          top: insets.top + 56,
          right: 16,
          bottom: CAROUSEL_HEIGHT + insets.bottom + 16,
          left: 16,
        }}
        markers={markers}
        onMapReady={handleMapReady}
        onMarkerPress={handleMarkerPress}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close hotel carousel demo"
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </Pressable>
        <View pointerEvents="none" style={styles.headerText}>
          <Text style={styles.headerTitle}>Hotel search</Text>
          <Text style={styles.headerSubtitle}>{statusText}</Text>
        </View>
      </View>

      <View
        style={[styles.carouselShell, { paddingBottom: insets.bottom + 12 }]}
      >
        <AnimatedFlatList
          ref={carouselRef}
          data={HOTELS as Hotel[]}
          keyExtractor={(hotel) => hotel.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={carouselLayout.snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{
            paddingHorizontal: carouselLayout.sideInset,
          }}
          getItemLayout={getCarouselItemLayout}
          renderItem={renderCarouselItem}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        />
      </View>

      <View
        pointerEvents="none"
        style={styles.rasterizer}
        collapsable={false}
        importantForAccessibility="no-hide-descendants"
      >
        {HOTELS.map((hotel) => (
          <View key={hotel.id} style={styles.rasterizerRow} collapsable={false}>
            <PinCapture
              hotelId={hotel.id}
              target="normal"
              price={hotel.price}
              category={hotel.category}
              focused={false}
              onCaptured={handlePinCaptured}
            />
            <PinCapture
              hotelId={hotel.id}
              target="focused"
              price={hotel.price}
              category={hotel.category}
              focused
              onCaptured={handlePinCaptured}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f10',
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    backgroundColor: 'rgba(18, 18, 20, 0.92)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerText: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 20, 0.72)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    marginTop: 2,
  },
  carouselShell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    backgroundColor: 'rgba(12, 12, 14, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardSelected: {
    backgroundColor: 'rgba(229, 57, 53, 0.22)',
    borderColor: 'rgba(229, 57, 53, 0.65)',
  },
  cardCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  cardPrice: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    marginTop: 6,
  },
  rasterizer: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
    zIndex: -1,
  },
  rasterizerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
});
