# Custom JSX markers: SDK evidence and performance boundaries

Research date: 2026-09-11. This note distinguishes documented SDK behavior from design hypotheses. It does not demonstrate 120 FPS in this package. The requested capability includes arbitrary JSX and animations inside each marker.

## Findings from primary sources

### Apple MapKit

`MKAnnotationView` is a `UIView`, so native view content is possible. Apple calls setting its `image` the most efficient way to provide annotation content. MapKit requests views for visible annotations and maintains a reuse queue. This supports a cached-image default and reusable live native hosts, but does not prove that moving a Fabric-owned React Native subtree into an annotation is supported or cheap. That lifecycle must be implemented and tested separately. [MKAnnotationView](https://developer.apple.com/documentation/mapkit/mkannotationview)

Apple explicitly recommends dequeuing annotation views to save allocation time and memory while scrolling. View reuse must reset marker-specific state, asynchronously loaded assets, and animation state. [dequeueReusableAnnotationView](<https://developer.apple.com/documentation/mapkit/mkmapview/dequeuereusableannotationview(withidentifier:for:)>)

### Google Maps iOS

`GMSMarker` accepts either an image through `icon` or a `UIView` hierarchy through `iconView`. The latter is rendered as a snapshot, does not receive direct user interaction, and supports animated view properties except `frame` and `center`. Google warns that many views tracking changes simultaneously can impair map rendering and consume more power. `tracksViewChanges = false` stops automatic view refresh; it should be enabled only for the interval during which asynchronous content or animation needs refreshing. A static `UIImage` avoids repeated view rendering. Thus “Google accepts bitmap icons only” is inaccurate as an API claim, although the distinction between a snapshot and an interactive in-map view remains essential. [Markers](https://developers.google.com/maps/documentation/ios-sdk/marker)

`GMSAdvancedMarker` also supports `iconView`, pin background/border colors, and glyph text/color through `GMSPinImageOptions`. Its documentation states that `iconView` and `icon` markers cannot be mixed on the same map; this needs explicit validation before migrating the existing mixed marker pipeline. It requires explicit host size/frame rather than external layout constraints on the icon view. [Advanced marker customization](https://developers.google.com/maps/documentation/ios-sdk/advanced-markers/customization)

Marker-level position, rotation, and opacity can be animated through `GMSMarkerLayer`. This is different from animating JSX contents: changing the whole marker does not require defining a fresh visual appearance. The layer does not support arbitrary inherited `CALayer` properties, so do not assume a portable scale/transform API. The page's OpenGL wording may lag the active renderer; rely on the property contract, not that implementation claim. [GMSMarkerLayer](https://developers.google.com/maps/documentation/ios-sdk/reference/objc/Classes/GMSMarkerLayer)

**120 FPS baseline caveat:** the currently served `GMSFrameRate.maximum` reference still describes 30 FPS on low-end devices and 60 FPS on high-end devices. This is a documented limit description, not an on-device measurement of the package's installed SDK. A React Native frame counter or a 120 Hz display cannot establish 120 distinct native Google Maps frames. Baseline evidence must identify provider, SDK version, device, and presented map frames. [GMSFrameRate](https://developers.google.com/maps/documentation/ios-sdk/reference/objc/Enums/GMSFrameRate)

### Google Maps Android

`AdvancedMarkerOptions.iconView()` accepts an Android `View`; Google explicitly warns its performance may fall below bitmap or default markers. `PinConfig` provides background, border, and glyph customization without requiring arbitrary React Native content. Marker motion/rotation should update `Marker`, not the host `View`. This disproves a blanket “no native view API” claim, but does not promise arbitrary child animations, nested touch handling, or equivalent performance. Those require a SDK-version-specific experiment. [Create an advanced marker](https://developers.google.com/maps/documentation/android-sdk/advanced-markers/add-marker)

Advanced markers require an upgraded renderer, a map ID, runtime `isAdvancedMarkersAvailable()` checks, and a fallback when unsupported. Adopting them is therefore a capability change rather than a drop-in implementation detail. [Advanced marker setup](https://developers.google.com/maps/documentation/android-sdk/advanced-markers/start)

### Nitro child hosting

The current guide establishes that Hybrid Views use Fabric and C++ ShadowNodes with Nitro prop parsing, that normal React prop updates occur on the UI thread, and that `RecyclableView.prepareForRecycle()` resets reused hosts. It does **not** document a `children` mounting/reparenting contract in the View Components guide. The `getHostComponent` example alone is insufficient evidence that JSX descendants will mount inside an arbitrary SDK annotation container. [View Components](https://nitro.margelo.com/docs/guides/view-components), [Hybrid Views](https://nitro.margelo.com/docs/concepts/hybrid-views)

Exact v0.35.10 generated host behavior is not established by this web research. Verify installed Nitrogen source/generated iOS and Android components before implementing a host. In particular, check whether children target the SDK view or its Fabric wrapper, how removal/recycling works, and which layer owns Yoga layout.

## Architecture hypotheses to test

These are engineering inferences and proposed constraints, not SDK guarantees:

1. Preserve the descriptor/image path for static markers. Cache appearances by content revision, dimensions, scale, and theme; share identical resources. Freeze static JSX after an initial render and explicit content invalidation.
2. Separate marker movement from appearance changes. Native coordinate/rotation/opacity animation can reuse the existing image. Animating an internal counter, gradient, layout, spinner, or Lottie object generally changes pixels and requires live rendering or refreshed snapshots; cached static icons do not satisfy that requirement.
3. Add a true JSX host as a separate measured path. On MapKit, try a reusable native host containing the RN subtree. On Google iOS, compare SDK `iconView` refresh with controlled explicit snapshots. On Android, compare Advanced Marker view support against a cached bitmap and measure actual animation behavior before selecting it.
4. An arbitrary JSX tree has unbounded layout, draw, memory, and JS work. No package architecture can guarantee 120 FPS for all JSX, all marker counts, and all animations. Define a workload envelope and measure both map gestures and content animation simultaneously. A bounded active/selected set is a feasible scaling strategy only if that meets the product requirement.
5. A native projected overlay could host interactive JSX where SDK markers cannot. Treat it as a separate experiment: camera synchronization, tilt/bearing, depth/collision, clipping, gestures, and accessibility are additional correctness work. Do not drive projection/positions through React state for every camera frame.
6. Snapshot refresh must have a shared budget and dirty queue, not an independent perpetual loop per marker. Off-screen/inactive views should stop updating where semantics allow. Avoid PNG/base64/file round-trips; keep native images in memory. Snapshotting UIKit/View hierarchies still has main-thread work; making an API asynchronous does not make that work free.

## Native profiling and acceptance

At 120 Hz, a display interval is about 8.33 ms; marker work receives only the portion left after the map and application do their own work. Apple recommends real-device Animation Hitches traces and investigating commit, render, and GPU phases. Its responsiveness guidance suggests keeping frame preparation near 5 ms for high refresh rate rendering. [Improving app responsiveness](https://developer.apple.com/documentation/xcode/improving-app-responsiveness)

On Android, use system traces and actual surface frame lifetimes, including main thread, RenderThread, GPU completion, and composition. The Android jank guide explains where expected deadlines and presented frames appear. A display refresh overlay or an average JS FPS figure is not sufficient. [UI jank detection](https://developer.android.com/studio/profile/jank-detection)

Android's rendering metrics can omit UI not drawn through the standard View/Canvas system, such as OpenGL content. Confirm the map renderer's surfaces are represented in the chosen measurement before accepting `gfxinfo`, JankStats, or a host-window frame metric as proof. [Slow rendering](https://developer.android.com/topic/performance/vitals/render)

Compare baseline and candidates with a repeatable gesture route and the same devices, SDKs, camera, tiles, marker locations, count, pixel size, unique visual count, and animation workload. Record presented frame cadence, missed deadlines/hitch time, frame percentiles, peak main-thread bursts, snapshot duration/count, memory, and sustained thermal behavior. Separate cold mount, warm pan/zoom, content updates, and continuous animation. A simulator snapshot microbenchmark can reject expensive strategies or estimate scaling; it cannot certify device FPS, React Native mount cost, or map texture-upload/composition cost.

## Corrections recommended for ADR 0004

- Replace the blanket Google bitmap-only table with the provider-specific contracts above.
- Keep snapshot-backed versus live-interactive semantics explicit; accepting a `View` does not imply live nested controls or free animation.
- Make cached images the high-throughput path on MapKit too; live hosting is a capability, not a performance guarantee.
- Mark automatic HybridView child mounting as unverified until the installed generator and lifecycle experiment establish it.
- Do not describe Phase 1 snapshots as satisfying arbitrary JSX animation requirements. It satisfies static/infrequently changing JSX only.
- Add measured provider-specific frame targets. In particular, current Google iOS documentation does not support an unconditional 120 FPS promise.
