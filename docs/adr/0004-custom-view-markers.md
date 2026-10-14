# ADR 0004: Custom view markers

## Status

Accepted — live projected hosts (`MarkerView`).

## Context

`Marker` elements are serialized descriptors drawn by the SDK: images, clustering, viewport culling, dragging and callouts, for thousands of points. Their `children` are never mounted.

Apps migrating from `react-native-maps` need markers drawn by arbitrary JSX: price bubbles, avatars, buttons, and animations inside them. The requirement is live content that stays interactive and animated, without costing the map its frame rate (60 FPS, 120 FPS on ProMotion where the provider renders that fast).

The SDKs disagree on what a marker can be:

| SDK                 | Live view as a marker?                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Apple MapKit        | `MKAnnotationView` can hold live views, but MapKit owns its lifecycle, reuse and hierarchy.           |
| Google Maps iOS     | `GMSMarker.iconView` is snapshotted: no interaction, and animation means re-snapshotting every frame. |
| Google Maps Android | Bitmap icons only; `AdvancedMarker.iconView` is also rendered to a bitmap.                            |

## Decision

Add `MarkerView`, a separate component, next to `Marker`.

Its JSX stays a Fabric subtree. The map mounts the host over its SDK view and moves it with the SDK's own projection on every camera callback, on the UI thread. The same mechanism serves all three providers.

- **No snapshots** and **no per-frame JavaScript**: a camera frame is one projection per mounted marker and a translation, pixel-snapped.
- **One pipeline:** a live marker is a `MarkerDescriptor` with `liveView: true`. Native clustering and viewport filtering place it like any marker. A registry takes live elements out of each diff before the SDK sees it and tells JS which hosts to mount. Clustered or culled markers are unmounted.
- **JSX clusters:** `renderCluster` replaces SDK badges with live `MarkerView`s.
- **Correct touches:** the shadow node reports the native translation (`getTransform()`), so `measure()` and `Pressable` see the marker where it is drawn. Taps on a marker do not reach the map, POIs or SDK markers beneath it; drags still pan the map unless the marker's content claims them.
- **Nitro views with children:** generated Nitro views take no children, so `scripts/patch-nitrogen-generated.mjs` routes Fabric mounts to Swift containers on iOS and makes the Android managers `ViewGroupManager`s. The script fails if the generated code changes shape.

## Alternatives

- **Snapshot JSX into the image pipeline.** Reuses everything, but freezes content: no interaction, and every animation frame is a capture, an encode and an SDK upload. In an iOS simulator experiment, the layer snapshots alone took about 10 ms for 50 markers and 37 ms for 200, against an 8.3 ms frame at 120 Hz.
- **SDK view markers** (`MKAnnotationView`, `iconView`). Live only on MapKit; snapshots on Google. Three behaviors behind one API.
- **Positions from JavaScript per frame.** A JS round trip and a React commit per camera frame cannot hold 120 FPS.

## Consequences

- Live markers are screen-aligned and drawn above SDK annotations. They do not get SDK collision, pitch occlusion, dragging, callouts or ground-plane rotation; `Marker` keeps those.
- The library cannot make arbitrary JSX free: each mounted marker is a live view. Clustering and culling bound how many are mounted; layout animations inside markers cost what they cost anywhere.
- On Android the map draws on its own surface and reports a camera frame after drawing it, so markers can trail fast pans by about a frame.
- The Nitrogen patch must be revisited on Nitro upgrades; it fails the codegen step rather than shipping a broken view.

See [Live JSX markers](../custom-marker-views.md) for the API and its limits.
