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

| Property | Behavior |
| --- | --- |
| `coordinate` | Required finite latitude −90…90 and longitude −180…180. Changing it repositions only that host. |
| `width`, `height` | Required positive finite dimensions in points/dp. They define layout, clipping, hit-testing, and the anchor reference. |
| `anchor` | Defaults to bottom-center (`{ x: 0.5, y: 1 }`). Components are finite fractions of the bounds; values outside 0…1 deliberately offset the host. |
| `children` | Live React Native tree. Animate child views inside the fixed bounds; the native host reserves its own transform for geographic position. |

Content is screen-aligned and clipped to its bounds and the map viewport. Marker views are composed above the SDK surface, including its annotations and controls. Use map padding/placement to avoid covering controls. Their order follows JSX order. They do not participate in SDK clustering, annotation collision, depth occlusion, dragging, callouts, or flat/ground-plane rotation. Use `Marker` descriptors for those SDK marker features and for large static datasets.

The same live-host mechanism is implemented for MapKit, Google iOS, and Google Android. The host stays in Fabric's hierarchy: the library does not steal/reparent RN children into SDK annotation views. On iOS, the generated component explicitly forwards Fabric mount/unmount into the Swift content container. On Android, ViewGroup managers keep the SDK surface out of Fabric child indices. The Nitrogen compatibility script validates its patch targets and fails if the generated shape changes.

Provider camera callbacks update positions synchronously on the native UI thread. Idle maps do not run a projection timer. Empty maps have no marker projection loop. Layout/coordinate changes update affected hosts; provider/map lifecycle tears down the association. Hosts outside the viewport are hidden from drawing/hit-testing, but this does not cancel application-owned timers or worklet animations.

## Performance contract and validation status

Removing snapshots eliminates one expensive class of work; it does not remove native view layout, React commits, projection, texture composition, or GPU cost. A simple child transform and an animated layout/text subtree have different costs. No universal 120 FPS guarantee is made for arbitrary JSX or unbounded marker counts.

The target is no material regression against the same provider and device baseline for a recorded workload. Google Maps iOS documents a 60 FPS maximum for its native map; a 120 Hz JSX overlay or display callback is not evidence of 120 distinct map frames. See [SDK evidence](research/custom-marker-sdk-sources.md).

The implementation is currently under native validation. Run the opt-in example with `EXPO_PUBLIC_MARKER_VIEW_BENCHMARK=1` in a Release build. Its A/B flow compares pins, static JSX, child transform animation, and child layout animation at 10/50/200 mounted hosts, using three passes and alternating mode order. Native callback intervals and memory are diagnostic data; Instruments/Perfetto and functional checks are also required before accepting the feature.

The example reuses the local FrameStats module introduced in PR #66. It is example-only and does not ship in the library. Trace the application without a debugger attached; identify the actual map presentation/animation cadence rather than treating display callback intervals as GPU frames. Record device/OS/SDK, visible count, thermal and power state, route, marker dimensions, and baseline/candidate traces.

See [snapshot experiment](../experiments/custom-markers/README.md) for the earlier hypothesis test and [research](research/custom-marker-performance.md) for the design alternatives. Those notes predate the live-host implementation; this document describes the implemented API.
