# Live custom marker views

`MarkerView` keeps arbitrary React Native content live above the native map. It positions the host using the provider's native coordinate projection, without bitmap snapshots or per-frame JavaScript camera events. Child state, `Pressable`, and Reanimated animations stay in Fabric.

```tsx
import { MapView, MarkerView } from 'react-native-better-maps';
import { Pressable, Text } from 'react-native';

<MapView style={{ flex: 1 }}>
  <MarkerView
    coordinate={{ latitude: 52.2297, longitude: 21.0122 }}
    width={96}
    height={48}
    anchor={{ x: 0.5, y: 1 }}
  >
    <Pressable onPress={() => selectPlace()} style={styles.priceBubble}>
      <Text>120 zł</Text>
    </Pressable>
  </MarkerView>
</MapView>;
```

Give every item a stable React key when rendering a list. Direct `MarkerView` children and nested React fragments are supported, as with the library's explicit overlay collection model. Arbitrary wrapper components returning a `MarkerView` are not collected: put the wrapper inside `MarkerView` instead.

## Contract

| Property          | Behavior                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | Stable identifier for cluster membership and `onClusterPress`; defaults to the scoped React key path. Must be unique across descriptor and live markers. |
| `clusterable`     | Defaults to true when map clustering is enabled; false keeps this point separate.                                                                        |
| `coordinate`      | Required finite latitude −90…90 and longitude −180…180. Changes reposition the host and update cluster membership when enabled.                          |
| `width`, `height` | Required positive finite dimensions in points/dp. They define layout, clipping, hit-testing, and the anchor reference.                                   |
| `anchor`          | Defaults to bottom-center (`{ x: 0.5, y: 1 }`). Components are finite fractions of the bounds; values outside 0…1 deliberately offset the host.          |
| `children`        | Live React Native tree. Animate child views inside the fixed bounds; the native host reserves its own transform for geographic position.                 |

Content is screen-aligned and clipped to its bounds and the map viewport. Marker views are composed above the SDK surface, including its annotations and controls. Use map padding/placement to avoid covering controls. Their order follows JSX order. Native clustering is shared with descriptor markers, as described below. Live hosts do not participate in SDK annotation collision, depth occlusion, dragging, callouts, or flat/ground-plane rotation. Use `Marker` descriptors for those SDK marker features and for large static datasets.

The same live-host mechanism is implemented for MapKit, Google iOS, and Google Android. The host stays in Fabric's hierarchy: the library does not steal/reparent RN children into SDK annotation views. On iOS, the generated component explicitly forwards Fabric mount/unmount into the Swift content container. On Android, ViewGroup managers keep the SDK surface out of Fabric child indices. The Nitrogen compatibility script validates its patch targets and fails if the generated shape changes.

Provider camera callbacks update positions synchronously on the native UI thread. Idle maps do not run a projection timer. Empty maps have no marker projection loop. Layout/coordinate changes update affected hosts; provider/map lifecycle tears down the association. Host projection hides offscreen content from drawing/hit-testing. The native clustering/large-dataset pipeline additionally controls which React subtrees are mounted. Unmounting releases their React/Reanimated subscriptions; application-owned external timers still require application cleanup.

## Clusters with arbitrary JSX

Enable `clusteringEnabled` to group nearby points. Marker count alone does not enable clustering. Descriptor markers and `MarkerView` children feed the same native engine and can belong to the same cluster. Without a renderer, clusters use the existing SDK badge. Supply `renderCluster` to replace those badges with live JSX:

```tsx
<MapView
  clusteringEnabled
  renderCluster={(cluster) => (
    <MarkerView coordinate={cluster.coordinate} width={96} height={48}>
      <Pressable onPress={cluster.onPress} style={styles.priceBubble}>
        <Animated.View style={animatedGlyphStyle} />
        <Text>{cluster.count} places</Text>
      </Pressable>
    </MarkerView>
  )}
>
  {places.map((place) => (
    <MarkerView
      key={place.id}
      id={place.id}
      coordinate={place.coordinate}
      width={96}
      height={48}
    >
      <PlaceBadge place={place} />
    </MarkerView>
  ))}
</MapView>
```

`renderCluster` must return a `MarkerView`. It receives the cluster `id`, `coordinate`, `count`, `markerIds`, and an async `onPress` helper that calls the map's `onClusterPress` and fits its camera to the cluster bounds. Use your own child `Pressable` for interaction; individual live marker presses are application-owned and do not automatically call `MapView.onMarkerPress`. Geographic position and React identity of the returned cluster host are assigned by the map.

Clustering runs in the existing native pipeline, off the UI thread for the clustered path. React receives a changed display set, rather than per-frame projected coordinates. Camera movement still positions mounted hosts natively. Points inside a cluster are **unmounted**, so hundreds of hidden animated subtrees do not continue running. Keep selection, editable content, and other persistent point state in application data outside the marker; local child state restarts after cluster expansion. A retained cluster keeps its React key while its count/membership updates.

The current native grid and badge-merging metrics remain in use; clustering does not measure arbitrary JSX bounds. Very large custom badges can overlap. Expansion/collapse is asynchronous, and coincident points may remain clustered. Benchmark the clustered view, zoom transitions, and fully expanded/sparse views: clustering cannot guarantee that every viewport has only a few rendered elements.

## Performance contract and validation status

Removing snapshots eliminates one expensive class of work; it does not remove native view layout, React commits, projection, texture composition, or GPU cost. A simple child transform and an animated layout/text subtree have different costs. No universal 120 FPS guarantee is made for arbitrary JSX or unbounded marker counts.

The target is no material regression against the same provider and device baseline for a recorded workload. Google Maps iOS documents a 60 FPS maximum for its native map; a 120 Hz JSX overlay or display callback is not evidence of 120 distinct map frames. See [SDK evidence](research/custom-marker-sdk-sources.md).

The corrected moving-camera [physical iPhone experiment](research/custom-marker-device-results.md) found 118.5–120.0 Hz main-thread callback cadence for 10/50 hosts, 119.3 Hz for 200 static hosts, 117.5–119.5 Hz for 200 transformed hosts, and 51.4–54.8 Hz for 200 animated-width hosts. These are callback diagnostics, not presented-frame proof; unrestricted 120 FPS acceptance remains open. The original duration-error runs are retained separately and excluded from moving-camera acceptance. Run the opt-in example with `EXPO_PUBLIC_MARKER_VIEW_BENCHMARK=1` in a Release build. Its A/B flow compares pins, static JSX, child transform animation, and child layout animation at 10/50/200 mounted hosts, using three passes and alternating mode order. Native callback intervals and memory are diagnostic data; Instruments/Perfetto and functional checks are also required before accepting the feature.

The example reuses the local FrameStats module introduced in PR #66. It is example-only and does not ship in the library. Trace the application without a debugger attached; identify the actual map presentation/animation cadence rather than treating display callback intervals as GPU frames. Record device/OS/SDK, visible count, thermal and power state, route, marker dimensions, and baseline/candidate traces.

See [snapshot experiment](../experiments/custom-markers/README.md) for the earlier hypothesis test and [research](research/custom-marker-performance.md) for the design alternatives. Those notes predate the live-host implementation; this document describes the implemented API.
