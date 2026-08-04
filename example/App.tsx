import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  MapView,
  type Coordinate,
  type EdgePadding,
  type MapProvider,
  type MapType,
  type MapViewRef,
  type OverlayEnteringAnimation,
  type PoiPressEvent,
  Region,
} from 'react-native-better-maps';
import {
  MAP_SCENARIOS,
  type MapScenario,
  createCustomMarkerImagesScenario,
  CUSTOM_MARKER_IMAGES_SCENARIO_ID,
} from './examples';

const MAP_TYPES: MapType[] = ['standard', 'satellite', 'hybrid'];
type SupportedExampleProvider = Extract<MapProvider, 'apple' | 'google'>;
type AnimationOptionId = 'system' | 'fade' | 'fade-scale' | 'none';

type AnimationOption = {
  id: AnimationOptionId;
  label: string;
  value: OverlayEnteringAnimation;
};

const PROVIDER_LABELS: Record<SupportedExampleProvider, string> = {
  apple: 'Apple MapKit',
  google: 'Google Maps',
};

const SUPPORTED_MAP_PROVIDERS = getSupportedMapProviders();

const ANIMATION_OPTIONS: AnimationOption[] = [
  { id: 'system', label: 'System', value: 'system' },
  { id: 'fade', label: 'Fade', value: { preset: 'fade', duration: 180 } },
  {
    id: 'fade-scale',
    label: 'Scale',
    value: { preset: 'fade-scale', duration: 180 },
  },
  { id: 'none', label: 'Off', value: false },
];

function getSupportedMapProviders(): SupportedExampleProvider[] {
  switch (Platform.OS) {
    case 'ios':
      return ['apple', 'google'];
    case 'android':
      return ['google'];
    default:
      return [];
  }
}

const MAP_TYPE_LABELS: Record<MapType, string> = {
  standard: 'Standard',
  satellite: 'Satellite',
  hybrid: 'Hybrid',
  terrain: 'Terrain',
};

/** Left inset reserved for the native map scale control. */
const SCALE_GUTTER_WIDTH = 156;

const springSnappy = { damping: 22, stiffness: 420 };
const springSoft = { damping: 20, stiffness: 240 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function mergeMapPadding(
  padding: EdgePadding | undefined,
  showsScale: boolean,
  showsCompass: boolean,
): EdgePadding | undefined {
  if (padding == null && !showsScale) {
    return undefined;
  }

  const base = padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

  if (!showsScale) {
    return base;
  }

  return {
    top: Math.max(base.top, 56),
    right: Math.max(base.right, showsCompass ? 52 : 16),
    bottom: base.bottom,
    left: Math.max(base.left, 12),
  };
}

const palette = {
  surface: 'rgba(18, 18, 20, 0.9)',
  surfaceElevated: 'rgba(28, 28, 32, 0.96)',
  border: 'rgba(255, 255, 255, 0.1)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  accent: '#3B82F6',
  accentSoft: 'rgba(59, 130, 246, 0.22)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  textMuted: 'rgba(255, 255, 255, 0.48)',
  success: '#34D399',
  warning: '#FBBF24',
};

type ScalePressableProps = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  hitSlop?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
};

const ScalePressable = memo(function ScalePressable({
  onPress,
  style,
  children,
  hitSlop,
  accessibilityRole,
  accessibilityState,
  accessibilityLabel,
}: ScalePressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      style={[style, animatedStyle]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, springSnappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springSnappy);
      }}
    >
      {children}
    </AnimatedPressable>
  );
});

type StatusDotProps = {
  mapReady: boolean;
};

const StatusDot = memo(function StatusDot({ mapReady }: StatusDotProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (mapReady) {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 200 });
      return;
    }

    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, {
          duration: 700,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: 700,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );
  }, [mapReady, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: mapReady ? palette.success : palette.warning,
  }));

  return <Animated.View style={[styles.statusDot, animatedStyle]} />;
});

type ScenarioChipProps = {
  index: number;
  label: string;
  active: boolean;
  onPress: () => void;
};

const ScenarioChip = memo(function ScenarioChip({
  index,
  label,
  active,
  onPress,
}: ScenarioChipProps) {
  return (
    <Animated.View
      layout={LinearTransition.springify().damping(20).stiffness(260)}
    >
      <ScalePressable
        onPress={onPress}
        style={[styles.scenarioChip, active && styles.scenarioChipActive]}
      >
        <Text
          style={[
            styles.scenarioChipIndex,
            active && styles.scenarioChipIndexActive,
          ]}
        >
          {index + 1}
        </Text>
        <Text
          style={[
            styles.scenarioChipText,
            active && styles.scenarioChipTextActive,
          ]}
        >
          {label}
        </Text>
      </ScalePressable>
    </Animated.View>
  );
});

const DOCK_BOTTOM_GAP = 12;

type ScenarioDockProps = {
  scenario: MapScenario;
  scenarioIndex: number;
  expanded: boolean;
  bottomInset: number;
  mapTypeLabel: MapType;
  providerLabel: string;
  animationOptionId: AnimationOptionId;
  canCycleProvider: boolean;
  onToggleExpanded: () => void;
  onSelect: (index: number) => void;
  onSelectAnimation: (animation: AnimationOptionId) => void;
  onAnimateCamera: () => void;
  onGetCamera: () => void;
  onCycleMapType: () => void;
  onCycleProvider: () => void;
  customMarkerRotation: number;
  customMarkerFlat: boolean;
  onCycleCustomMarkerRotation: () => void;
  onToggleCustomMarkerFlat: () => void;
};

const ScenarioDock = memo(function ScenarioDock({
  scenario,
  scenarioIndex,
  expanded,
  bottomInset,
  mapTypeLabel,
  providerLabel,
  animationOptionId,
  canCycleProvider,
  onToggleExpanded,
  onSelect,
  onSelectAnimation,
  onAnimateCamera,
  onGetCamera,
  onCycleMapType,
  onCycleProvider,
  customMarkerRotation,
  customMarkerFlat,
  onCycleCustomMarkerRotation,
  onToggleCustomMarkerFlat,
}: ScenarioDockProps) {
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    chevronRotation.value = withTiming(expanded ? 180 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, chevronRotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(120)}
      layout={LinearTransition.springify()}
      style={[
        styles.dock,
        expanded && styles.dockExpandedContainer,
        { bottom: bottomInset + DOCK_BOTTOM_GAP },
      ]}
    >
      {expanded ? (
        <Animated.View
          entering={FadeInDown.springify()}
          exiting={FadeOut.springify()}
          style={styles.dockExpanded}
        >
          <View style={styles.dockHeader}>
            <View style={styles.dockHeaderText}>
              <Text style={styles.dockEyebrow}>
                Scenario {scenarioIndex + 1} of {MAP_SCENARIOS.length}
              </Text>
              <Text style={styles.dockTitle} numberOfLines={1}>
                {scenario.name}
              </Text>
            </View>
            <ScalePressable
              onPress={onToggleExpanded}
              hitSlop={8}
              style={styles.iconButton}
            >
              <Animated.Text style={[styles.iconButtonText, chevronStyle]}>
                ▴
              </Animated.Text>
            </ScalePressable>
          </View>

          <Text style={styles.dockDescription}>{scenario.description}</Text>

          <View style={styles.divider} />

          <View style={styles.controlGroup}>
            <Text style={styles.controlLabel}>Entering animation</Text>
            <View style={styles.optionRow}>
              {ANIMATION_OPTIONS.map((option) => (
                <ScalePressable
                  key={option.id}
                  onPress={() => onSelectAnimation(option.id)}
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: option.id === animationOptionId,
                  }}
                  accessibilityLabel={`${option.label} entering animation`}
                  style={[
                    styles.optionChip,
                    option.id === animationOptionId && styles.optionChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      option.id === animationOptionId &&
                        styles.optionChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </ScalePressable>
              ))}
            </View>
          </View>

          <View style={styles.actionRow}>
            <ScalePressable
              onPress={onAnimateCamera}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonIcon}>↻</Text>
              <Text style={styles.actionButtonText}>Animate</Text>
            </ScalePressable>
            <ScalePressable onPress={onGetCamera} style={styles.actionButton}>
              <Text style={styles.actionButtonIcon}>◎</Text>
              <Text style={styles.actionButtonText}>Camera</Text>
            </ScalePressable>
            <ScalePressable
              onPress={onCycleMapType}
              style={[styles.actionButton, styles.actionButtonAccent]}
            >
              <Text style={styles.actionButtonIcon}>◫</Text>
              <Text style={styles.actionButtonText}>
                {MAP_TYPE_LABELS[mapTypeLabel]}
              </Text>
            </ScalePressable>
            {canCycleProvider ? (
              <ScalePressable
                onPress={onCycleProvider}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonIcon}>⌁</Text>
                <Text style={styles.actionButtonText}>{providerLabel}</Text>
              </ScalePressable>
            ) : null}
          </View>

          {scenario.id === CUSTOM_MARKER_IMAGES_SCENARIO_ID ? (
            <View style={styles.actionRow}>
              <ScalePressable
                onPress={onCycleCustomMarkerRotation}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonIcon}>↻</Text>
                <Text style={styles.actionButtonText}>
                  Rotate {customMarkerRotation.toFixed(0)}°
                </Text>
              </ScalePressable>
              <ScalePressable
                onPress={onToggleCustomMarkerFlat}
                style={[styles.actionButton, styles.actionButtonAccent]}
              >
                <Text style={styles.actionButtonIcon}>▭</Text>
                <Text style={styles.actionButtonText}>
                  Flat {customMarkerFlat ? 'on' : 'off'}
                </Text>
              </ScalePressable>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      <View style={styles.dockRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scenarioScroll}
          contentContainerStyle={styles.scenarioPicker}
        >
          {MAP_SCENARIOS.map((item, index) => (
            <ScenarioChip
              key={item.id}
              index={index}
              label={item.name}
              active={index === scenarioIndex}
              onPress={() => onSelect(index)}
            />
          ))}
        </ScrollView>
        {!expanded ? (
          <ScalePressable
            onPress={onToggleExpanded}
            hitSlop={8}
            style={styles.iconButton}
          >
            <Animated.Text style={[styles.iconButtonText, chevronStyle]}>
              ▴
            </Animated.Text>
          </ScalePressable>
        ) : null}
      </View>
    </Animated.View>
  );
});

type MapSceneProps = {
  ref?: Ref<MapViewRef>;
  scenario: MapScenario;
  provider: SupportedExampleProvider;
  mapType: MapType;
  mapPadding?: EdgePadding;
  animationOption: AnimationOption;
  onMapReady: () => void;
  onClusterPress: (markerIds: string[], coordinate: Coordinate) => void;
  onMarkerPress: (id: string) => void;
  onMarkerDragEnd: (id: string, coordinate: Coordinate) => void;
  onOverlayPress: (label: string) => void;
  onPress: (coordinate: Coordinate) => void;
  onPoiPress: (event: PoiPressEvent) => void;
  onLongPress: (coordinate: Coordinate) => void;
  onRegionChange: (region: Region) => void;
  onRegionChangeComplete: (region: Region) => void;
};

const MapScene = memo(function MapScene({
  ref,
  scenario,
  provider,
  mapType,
  mapPadding,
  animationOption,
  onMapReady,
  onClusterPress,
  onMarkerPress,
  onMarkerDragEnd,
  onOverlayPress,
  onPress,
  onPoiPress,
  onLongPress,
  onRegionChange,
  onRegionChangeComplete,
}: MapSceneProps) {
  const commonMapProps = {
    style: styles.map,
    mapType,
    region: scenario.region,
    clusteringEnabled: scenario.advanced?.clusteringEnabled,
    showsUserLocation: scenario.advanced?.showsUserLocation,
    followsUserLocation: scenario.advanced?.followsUserLocation,
    showsCompass: scenario.advanced?.showsCompass,
    customMapStyle: scenario.advanced?.customMapStyle,
    mapPadding,
    markerEnteringAnimation: animationOption.value,
    clusterEnteringAnimation: scenario.advanced?.clusteringEnabled
      ? animationOption.value
      : undefined,
    markers: scenario.markers,
    polylines: scenario.polylines,
    polygons: scenario.polygons,
    circles: scenario.circles,
    onMapReady,
    onClusterPress,
    onMarkerPress,
    onMarkerDragEnd,
    onPress,
    onPoiPress,
    onLongPress,
    onPolylinePress: onOverlayPress,
    onPolygonPress: onOverlayPress,
    onCirclePress: onOverlayPress,
    onRegionChange,
    onRegionChangeComplete,
  };

  if (provider === 'apple') {
    return (
      <MapView
        ref={ref}
        key={`${scenario.id}:${animationOption.id}:apple`}
        {...commonMapProps}
        provider="apple"
        showsScale={scenario.advanced?.showsScale}
      />
    );
  }

  return (
    <MapView
      ref={ref}
      key={`${scenario.id}:${animationOption.id}:google`}
      {...commonMapProps}
      provider="google"
    />
  );
});

type StatusHeaderProps = {
  status: string;
  scenarioIndex: number;
  mapReady: boolean;
  showsScale: boolean;
};

const StatusHeader = memo(function StatusHeader({
  status,
  scenarioIndex,
  mapReady,
  showsScale,
}: StatusHeaderProps) {
  const badgeScale = useSharedValue(1);

  useEffect(() => {
    badgeScale.value = withSequence(
      withSpring(1.08, springSnappy),
      withSpring(1, springSoft),
    );
  }, [scenarioIndex, badgeScale]);

  const scenarioBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.springify().delay(60)}
      style={[styles.header, showsScale && styles.headerWithScale]}
      pointerEvents="none"
    >
      {showsScale ? <View style={styles.scaleGutter} /> : null}

      <View style={styles.headerContent}>
        <View style={styles.headerTopRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>NITRO MAPS</Text>
          </View>
          <Animated.View style={[styles.scenarioBadge, scenarioBadgeStyle]}>
            <Text style={styles.scenarioBadgeText}>
              {scenarioIndex + 1}/{MAP_SCENARIOS.length}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.statusCard}>
          <StatusDot mapReady={mapReady} />
          <Animated.View
            key={status}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.statusTextWrap}
          >
            <Text style={styles.statusText} numberOfLines={2}>
              {status}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
});

export default function App() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewRef>(null);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [mapTypeIndex, setMapTypeIndex] = useState(0);
  const [providerIndex, setProviderIndex] = useState(0);
  const [animationOptionIndex, setAnimationOptionIndex] = useState(0);
  const [status, setStatus] = useState('Waiting for map...');
  const [mapReady, setMapReady] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(false);
  const [customMarkerRotation, setCustomMarkerRotation] = useState(45);
  const [customMarkerFlat, setCustomMarkerFlat] = useState(true);

  const baseScenario = MAP_SCENARIOS[scenarioIndex];
  const scenario = useMemo(() => {
    if (baseScenario.id !== CUSTOM_MARKER_IMAGES_SCENARIO_ID) {
      return baseScenario;
    }

    return createCustomMarkerImagesScenario({
      rotation: customMarkerRotation,
      flat: customMarkerFlat,
    });
  }, [baseScenario, customMarkerRotation, customMarkerFlat]);
  const provider = SUPPORTED_MAP_PROVIDERS[providerIndex] ?? 'google';
  const animationOption = ANIMATION_OPTIONS[animationOptionIndex];
  const showsScale = scenario.advanced?.showsScale === true;
  const showsCompass = scenario.advanced?.showsCompass === true;
  const mapPadding = useMemo(
    () =>
      mergeMapPadding(scenario.advanced?.mapPadding, showsScale, showsCompass),
    [scenario, showsScale, showsCompass],
  );

  const handleAnimateCamera = useCallback(() => {
    mapRef.current
      ?.animateCamera(
        {
          center: {
            latitude: scenario.region.latitude,
            longitude: scenario.region.longitude,
          },
          zoom: 13,
          heading: 0,
          pitch: 0,
        },
        1,
      )
      ?.catch(() => {});
  }, [scenario]);

  const handleGetCamera = useCallback(async () => {
    try {
      const camera = await mapRef.current?.getCamera();
      if (camera == null) {
        return;
      }

      setStatus(
        `zoom ${camera.zoom?.toFixed(1) ?? '?'} · ${camera.center.latitude.toFixed(4)}, ${camera.center.longitude.toFixed(4)}`,
      );
    } catch {
      // Map unmounted or native call failed — ignore.
    }
  }, []);

  const cycleMapType = useCallback(() => {
    setMapTypeIndex((current) => (current + 1) % MAP_TYPES.length);
  }, []);

  const cycleCustomMarkerRotation = useCallback(() => {
    setCustomMarkerRotation((current) => (current + 45) % 360);
  }, []);

  const toggleCustomMarkerFlat = useCallback(() => {
    setCustomMarkerFlat((current) => !current);
  }, []);

  const cycleProvider = useCallback(() => {
    setProviderIndex((current) => {
      if (SUPPORTED_MAP_PROVIDERS.length <= 1) {
        setStatus(PROVIDER_LABELS[provider]);
        return current;
      }

      const next = (current + 1) % SUPPORTED_MAP_PROVIDERS.length;
      setMapReady(false);
      setStatus(PROVIDER_LABELS[SUPPORTED_MAP_PROVIDERS[next] ?? provider]);
      return next;
    });
  }, [provider]);

  const selectScenario = useCallback(
    (index: number) => {
      if (index === scenarioIndex) {
        return;
      }
      setScenarioIndex(index);
      setMapReady(false);
      setStatus(MAP_SCENARIOS[index].name);
    },
    [scenarioIndex],
  );

  const toggleDockExpanded = useCallback(() => {
    setDockExpanded((current) => !current);
  }, []);

  const selectAnimation = useCallback(
    (animation: AnimationOptionId) => {
      const nextIndex = ANIMATION_OPTIONS.findIndex(
        (option) => option.id === animation,
      );
      if (nextIndex < 0 || nextIndex === animationOptionIndex) {
        return;
      }

      setAnimationOptionIndex(nextIndex);
      setMapReady(false);
      setStatus(`Animation · ${ANIMATION_OPTIONS[nextIndex].label}`);
    },
    [animationOptionIndex],
  );

  const handleMarkerPress = useCallback((id: string) => {
    setStatus(`Marker · ${id}`);
  }, []);

  const handleMarkerDragEnd = useCallback(
    (id: string, coordinate: Coordinate) => {
      setStatus(
        `${id} → ${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`,
      );
    },
    [],
  );

  const handleOverlayPress = useCallback((label: string) => {
    setStatus(label);
  }, []);

  const handleClusterPress = useCallback(
    (markerIds: string[], coordinate: Coordinate) => {
      setStatus(
        `Cluster (${markerIds.length}) · ${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`,
      );
    },
    [],
  );

  const handleMapReady = useCallback(() => {
    setMapReady(true);
    setStatus(scenario.name);

    if (
      scenario.advanced?.fitToCoordinatesOnReady &&
      scenario.markers != null
    ) {
      mapRef.current
        ?.fitToCoordinates(
          scenario.markers.map((marker) => marker.coordinate),
          mapPadding,
          true,
        )
        ?.catch(() => {});
    }
  }, [scenario, mapPadding]);

  const handleMapPress = useCallback((coordinate: Coordinate) => {
    setStatus(
      `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`,
    );
  }, []);

  const handlePoiPress = useCallback((event: PoiPressEvent) => {
    if (event.provider === 'google') {
      setStatus(`POI · Google · ${event.name} · ${event.placeId}`);
      return;
    }

    setStatus(
      `POI · Apple · ${event.name ?? event.category} · ${event.category}`,
    );
  }, []);

  const handleMapLongPress = useCallback((coordinate: Coordinate) => {
    setStatus(
      `Long · ${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`,
    );
  }, []);

  const handleRegionChange = useCallback((region: Region) => {
    setStatus(
      `Region start · ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`,
    );
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setStatus(
      `Region complete · ${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`,
    );
  }, []);

  return (
    <View style={styles.container}>
      <MapScene
        ref={mapRef}
        scenario={scenario}
        provider={provider}
        mapType={MAP_TYPES[mapTypeIndex]}
        mapPadding={mapPadding}
        animationOption={animationOption}
        onMapReady={handleMapReady}
        onClusterPress={handleClusterPress}
        onMarkerPress={handleMarkerPress}
        onMarkerDragEnd={handleMarkerDragEnd}
        onOverlayPress={handleOverlayPress}
        onPress={handleMapPress}
        onPoiPress={handlePoiPress}
        onLongPress={handleMapLongPress}
        onRegionChange={handleRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
      />

      <StatusHeader
        status={status}
        scenarioIndex={scenarioIndex}
        mapReady={mapReady}
        showsScale={showsScale}
      />

      <ScenarioDock
        scenario={scenario}
        scenarioIndex={scenarioIndex}
        expanded={dockExpanded}
        bottomInset={insets.bottom}
        mapTypeLabel={MAP_TYPES[mapTypeIndex]}
        providerLabel={PROVIDER_LABELS[provider]}
        animationOptionId={animationOption.id}
        canCycleProvider={SUPPORTED_MAP_PROVIDERS.length > 1}
        onToggleExpanded={toggleDockExpanded}
        onSelect={selectScenario}
        onSelectAnimation={selectAnimation}
        onAnimateCamera={handleAnimateCamera}
        onGetCamera={handleGetCamera}
        onCycleMapType={cycleMapType}
        onCycleProvider={cycleProvider}
        customMarkerRotation={customMarkerRotation}
        customMarkerFlat={customMarkerFlat}
        onCycleCustomMarkerRotation={cycleCustomMarkerRotation}
        onToggleCustomMarkerFlat={toggleCustomMarkerFlat}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
  },
  map: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerWithScale: {
    top: Platform.OS === 'ios' ? 56 : 20,
  },
  scaleGutter: {
    width: SCALE_GUTTER_WIDTH,
    height: 56,
    flexShrink: 0,
  },
  headerContent: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBadge: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: palette.textSecondary,
  },
  scenarioBadge: {
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scenarioBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.accent,
    fontVariant: ['tabular-nums'],
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTextWrap: {
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: palette.surfaceElevated,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  dockExpandedContainer: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scenarioScroll: {
    flex: 1,
  },
  dockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  dockHeaderText: {
    flex: 1,
    gap: 2,
  },
  dockEyebrow: {
    fontSize: 11,
    fontWeight: '500',
    color: palette.textMuted,
    letterSpacing: 0.2,
  },
  dockTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: -0.2,
  },
  dockDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: palette.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
  dockExpanded: {
    gap: 12,
  },
  controlGroup: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textMuted,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    flexGrow: 1,
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  optionChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.textSecondary,
  },
  optionChipTextActive: {
    color: palette.text,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: -1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    gap: 2,
  },
  actionButtonAccent: {
    backgroundColor: palette.accentSoft,
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  actionButtonIcon: {
    fontSize: 14,
    color: palette.textSecondary,
    lineHeight: 16,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.text,
  },
  scenarioPicker: {
    gap: 8,
    paddingVertical: 2,
  },
  scenarioChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: palette.border,
  },
  scenarioChipActive: {
    backgroundColor: palette.accentSoft,
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  scenarioChipIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  scenarioChipIndexActive: {
    color: palette.accent,
  },
  scenarioChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: palette.textSecondary,
  },
  scenarioChipTextActive: {
    color: palette.text,
    fontWeight: '600',
  },
});
