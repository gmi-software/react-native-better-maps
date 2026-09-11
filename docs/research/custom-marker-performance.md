# Custom JSX markers without regressing map performance

Investigation: 2026-09-11, package source baseline `1c38c93`. Requested scope: arbitrary JSX, including animations inside markers. This is a research recommendation, not an accepted ADR or shipped implementation.

## Recommendation

Use two rendering contracts. Preserve cached image descriptors for static appearances; add an explicit live JSX host for animated content, starting with MapKit. Do not make per-frame bitmap snapshots the general implementation of animated JSX.

There is no demonstrated universal 120 FPS solution for arbitrary trees, arbitrary marker counts, and all current providers. The feasible objective is no material regression against the **same provider's measured baseline within a defined workload**. A finite, measured set of visible animated hosts can be supported; a blanket promise cannot be justified by Nitro or these experiments.

On iOS Google Maps, the installed 10.14.0 header and current official reference both describe the maximum map frame rate as 60 FPS on high-end devices. Establish a provider-specific baseline before treating a React Native 120 FPS counter as native map FPS. [GMSFrameRate](https://developers.google.com/maps/documentation/ios-sdk/reference/objc/Enums/GMSFrameRate)

## Evidence in this repository

| Existing seam                                                                                                                                                                                          | Finding and consequence                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`Marker.tsx`](../../package/src/components/Marker.tsx), [`MapView.tsx`](../../package/src/components/MapView.tsx)                                                                                     | Markers are collected as descriptors, and the native map is rendered without child content. Adding JSX cannot be implemented solely by extending marker prop types.                                                                                                                     |
| [`MapOverlayController.swift`](../../package/ios/MapOverlayController.swift), [`MarkerClusterEngine.swift`](../../package/ios/MarkerClusterEngine.swift)                                               | The native viewport/diff pipeline retains annotations and updates visual properties when they change. Keep geographic identity independent of appearance resources.                                                                                                                     |
| [`MapMarkerAnnotation.swift`](../../package/ios/MapMarkerAnnotation.swift)                                                                                                                             | A coordinate change is distinct from an image/visual change. Moving a marker should not invalidate a static raster.                                                                                                                                                                     |
| [`GoogleMarkerVisualApplier.swift`](../../package/ios/GoogleMarkerVisualApplier.swift), [`MarkerIconFactory.kt`](../../package/android/src/main/java/com/margelo/nitro/nitromaps/MarkerIconFactory.kt) | Existing image-key/generation handling avoids some repeated application and stale async updates. Preserve these guards for snapshot resources.                                                                                                                                          |
| [`MarkerImageLoader.swift`](../../package/ios/MarkerImageLoader.swift)                                                                                                                                 | Native image cache is keyed by URI/size/scale. There is no configured byte limit or shared pending-load registry in this loader. A new snapshot for every frame with a new URI would grow work/cache pressure; reusing a URI with changed bytes can instead leave stale cached content. |
| [`MarkerIconFactory.kt`](../../package/android/src/main/java/com/margelo/nitro/nitromaps/MarkerIconFactory.kt)                                                                                         | Icon cache holds 64 entries, not a byte budget. Many unique appearances can churn when markers are removed/re-added. Already retained markers skip identical icon application, so this is not a claim that all visible icons reload every frame.                                        |
| [`GoogleMapOverlayController.swift`](../../package/ios/GoogleMapOverlayController.swift)                                                                                                               | Entering animations already have a per-diff budget. Custom content needs its own measured budget; the existing cap is not evidence that arbitrary child animation is cheap.                                                                                                             |
| [`HybridMapView.swift`](../../package/ios/HybridMapView.swift)                                                                                                                                         | Host currently returns a plain container UIView and installs a provider adapter. Fabric child ownership, placement, recycling, and events need an explicit experiment.                                                                                                                  |

The local package dependency links point into a missing root `node_modules`; generated view descriptors exist, but they do not establish arbitrary child reparenting support. No React Native host build/test was run. Local `example/ios/Podfile.lock` records GoogleMaps 10.14.0 and NitroModules 0.35.10. The installed GoogleMaps header independently confirms `iconView`, default `tracksViewChanges = YES`, and the documented 60 FPS maximum. These are local installation evidence, not a universal dependency pin for consumers.

## Experiments completed

Built and ran an isolated optimized UIKit app twice in the iOS 26.5 simulator. Each case used 20 timed samples after three warmups, with the second run reversing case order. A 96 × 48 point, 3× marker contained a rounded background, circular avatar placeholder, and a changing price label.

| Work per batch                                  | 50 markers, median range | 200 markers, median range |
| ----------------------------------------------- | -----------------------: | ------------------------: |
| Assign existing UIImage to detached UIImageView |           0.265–0.640 ms |            0.853–2.134 ms |
| Native layer snapshot, image stays in memory    |           9.641–9.960 ms |          35.788–37.301 ms |
| Layer snapshot + PNG encoding + forced decode   |         47.432–51.956 ms |        187.313–201.881 ms |

These are **CPU batch timings, not map FPS**. The cached case excludes SDK application/upload; the snapshot cases exclude RN layout/reconciliation, map rendering, and GPU composition. The simulator reports a 60 Hz maximum. The results support avoiding repeated capture and image conversion; they cannot certify live-host performance or predict device FPS. Full method, hierarchy-capture results, raw samples, and commands: [experiment](../../experiments/custom-markers/README.md).

## Proposed architecture

### Static or infrequently changing JSX

Render JSX through a native host, snapshot when the content is ready, and retain the resulting native image as an immutable appearance resource. Use an explicit revision/refresh contract; do not infer visual equality by serializing arbitrary React elements. Asset completion, size, density, theme, locale, and font-scale changes must invalidate the correct appearance.

Use a native resource handle/ID, not PNG/base64 or a temporary file for each revision. The current `MarkerImage` URI descriptor is useful for a quick static proof of concept, but an in-memory resource registry is the target for frequently refreshed views. Image bytes should not traverse JS. Share resources only when the caller provides a valid shared appearance identity; two marker IDs do not imply two different images.

The registry needs a measured byte budget, reference ownership for visible markers, coalesced requests for the same pending appearance, generation checks, and release on removal/recycle. A marker's coordinate/rotation/opacity must not be part of its appearance key unless that value actually changes internal pixels. Submit appearance changes directly to affected native markers rather than rebuilding the whole descriptor array for every animation tick.

Capture only dirty appearances. Coalesce intermediate revisions and schedule cold work with a global budget. UIKit/Android View capture still requires main-thread work; an async method does not move arbitrary UI rendering to a background queue. Cold mount, bursts after avatar downloads, and invalidation of every marker on theme change need separate tests.

### Animated JSX: first candidate is a live MapKit host

Keep the actual RN subtree inside a reusable native host associated with an `MKAnnotationView`. Let native view/layer composition handle animations that can stay on the UI/compositor path. The map owns geographic placement; camera movement must not go through per-frame React state updates.

First prove Fabric mount/unmount, child placement, Yoga sizing, touch routing, accessibility, and safe reuse. Do not manually steal an RN view from its Fabric parent and assume event/layout ownership survives. MapKit annotation reuse and RN subtree reuse are different lifecycles: preserve identity and reset state deliberately.

Reanimated can remove React/JS work for some animations, but it does not make layout, drawing, GPU composition, or snapshotting free. Animating internal text/layout is a different workload from rotating a composited child layer. Test both. A static snapshot mode must not silently freeze an animation requested as live.

Only visible, unclustered hosts should incur rendering work where semantics permit. A selected/active subset is an optional product tradeoff, **not** a fulfillment of a requirement that every visible marker animate. If every visible marker must animate, benchmark that exact count and tree and publish the supported envelope.

### Google backends require separate decisions

For classic Google iOS markers, compare `GMSMarker.iconView` tracking only during active animation against controlled native snapshots. `iconView` is already SDK-managed snapshot rendering and does not provide interactive nested UIKit controls. Do not use this experiment's `drawHierarchy` number as its implementation cost. Idle content should disable tracking. [Google iOS markers](https://developers.google.com/maps/documentation/ios-sdk/marker)

On Android, evaluate `AdvancedMarkerOptions.iconView` only after confirming the renderer, map ID, capabilities, RN child mounting, and actual child-animation behavior. The SDK explicitly warns about performance compared with bitmaps. Existing classic-marker fallback remains necessary. [Advanced markers](https://developers.google.com/maps/documentation/android-sdk/advanced-markers/add-marker)

If live interactive JSX is mandatory where the SDK only snapshots it, the alternative experiment is a native overlay host synchronized with native camera projection. It must handle tilt/bearing, clipping, anchors, z-order, collision policy, hit-testing, and accessibility. Driving hundreds of screen positions through JS every frame is not a suitable design. A 120 Hz overlay over a documented 60 FPS map is also not proof that the map itself runs at 120 FPS.

Separate internal content animation from native whole-marker position/rotation/opacity animation, which can reuse a static image where supported. Repeating decorative animations may sometimes use shared pre-rendered frames (Google iOS accepts animated UIImage), but that is a memory tradeoff and cannot replace arbitrary live stateful JSX. No cross-provider scale/transform support should be assumed. [GMSMarkerLayer](https://developers.google.com/maps/documentation/ios-sdk/reference/objc/Classes/GMSMarkerLayer)

## Next implementation experiment and acceptance

1. Establish Release-build native baselines for MapKit, Google iOS, and Google Android separately on real devices. Record device/OS/SDK and refresh behavior, tile warmup, thermal state, and power mode.
2. Implement a minimal MapKit JSX host with one animated child. Prove Fabric lifecycle/recycle correctness, then compare live host and cached image at 1, 10, 50, and 200 visible markers. These are test points, not proposed supported limits.
3. Exercise two content classes: a compositor-friendly child transform and a counter/layout change. Test idle map and identical pan/zoom/rotate routes. Measure JS, UI, render/GPU, actual map presentation, and marker-animation cadence separately.
4. Exercise 20 versus all-unique appearances, 48 versus 96 point content, cold entry, selection, rapid add/remove, image arrival, clustering, theme/font changes, and offscreen/reentry. Benchmark after 5–10 minutes as well as immediately after launch.
5. Independently compare Google `iconView`/Advanced Marker candidates. Do not carry a successful MapKit result over to Google or label a 60 FPS renderer as a 120 FPS result.

Use Instruments Animation Hitches/Core Animation and Android system traces/FrameTimeline with the map surface identified. A CADisplayLink, RN FPS overlay, or host-window frame counter alone is insufficient evidence. [Apple responsiveness](https://developer.apple.com/documentation/xcode/improving-app-responsiveness), [Android jank detection](https://developer.android.com/studio/profile/jank-detection)

Before calling the feature performance-preserving, define a numeric tolerance against repeated baseline traces and require it for missed deadlines/hitch time, p95/p99 frame timing, memory, and sustained behavior. Also require the requested content animation to progress at its target cadence: freezing/throttling it while reporting smooth map movement is not success. A snapshot queue should expose pending revisions, capture time, age, and active animations so overload cannot be hidden.

## Status

- **Verified:** current architecture, documented SDK boundaries, installed Google iOS header, optimized UIKit experiment executed twice, saved raw results.
- **Not run:** real-device 120 Hz traces, a JSX/Fabric live-host prototype, native map A/B measurements, Android runtime measurements.
- **Decision proposed:** preserve image descriptors; start animated JSX with a MapKit live-host experiment; budget and qualify Google separately. ADR 0004 remains proposed and should be revised after those results, especially its blanket bitmap-only statement and the claim that static snapshots satisfy animated JSX.

Primary-source detail: [SDK research](custom-marker-sdk-sources.md).
