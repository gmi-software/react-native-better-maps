# ADR 0007: Camera stream, Reanimated binding, and the shared C++ core

## Status

Accepted

## Context

The performance audit's last phase listed three optional items: an opt-in stream of the
camera while it moves, a Reanimated binding for overlays that follow the map, and a shared
C++ core for the marker store, index and clustering, the last one only "if profiling after
phase 3 shows Kotlin or Swift compute as the limiter".

The camera reaches JS twice per gesture (`onRegionChange`, `onRegionChangeComplete`),
which is right for data loading and wrong for a compass or a custom overlay that must track
the map: those had to poll `getCamera()`, a three-hop promise per call.

## Decision

- **`onCameraMove` and `cameraMoveThrottleMs`.** While the camera moves the adapter emits
  the camera at most every `cameraMoveThrottleMs` (default 100 ms) and once more when it
  stops. MapKit samples the camera on a display link that runs only during the move; the
  Google SDKs already report every frame and the adapter throttles. Nothing runs unless the
  callback is set, so the idle map stays at zero work and the default map stays out of the
  per-frame JS path.
- **`react-native-better-maps/reanimated`.** A separate entry point with
  `useCameraSharedValue`, which returns a shared value and a stable `onCameraMove` handler
  that writes into it. Overlays read the value in `useAnimatedStyle` and follow the camera on
  the UI thread without a React render per update. `react-native-reanimated` is an optional
  peer dependency; the main entry point does not import it.
- **Shared C++ core: not built.** The audit made it conditional on profiling showing
  Swift or Kotlin compute as the limiter after the frame-budgeted pipeline. The signposts
  from the 100,000-marker clustered scenario on the iPhone simulator put the whole compute
  side (index query, clustering, diff) on the background queue at a p95 of 6.5 ms and a
  maximum of 10 ms, and the main-thread apply at a maximum of 3.6 ms; the scenario that
  still drops frames (10,000 markers inside one city viewport) spends up to 15 ms on the main
  thread inside MapKit's annotation-view layout while its compute stays under 3.1 ms.
  On the Android emulator the same 100,000-marker scenario holds a 17 ms p99 and a 33 ms worst frame, so Kotlin compute is not limiting frames there either. A C++ core would speed up the part that is
  already off the main thread and already under a frame, and would leave the SDK view work
  where it is. The store, index and cluster engine keep their two native implementations,
  which share the packed batch format and the same test fixtures. The decision is revisited
  if a future dataset or a device shows the background compute reaching the frame budget.

## Consequences

- A low throttle is a per-frame JS call. The Reanimated binding keeps the handler to one
  assignment, which is the cheap end of what a per-frame call can do; a handler that sets
  React state at 16 ms would re-render at 60 Hz.
- The stream reports the camera the SDK reports. On MapKit that is `MKMapView.camera` at
  the display link's tick; during an animated camera change it follows the animation.
- Two entry points means two type roots in `lib/typescript`; `react-native-builder-bob`
  compiles the whole `src` tree, so nothing changes in the build.

## Alternatives considered

- **A per-frame native binding to Reanimated's worklet runtime.** Would move the camera
  into a shared value without touching the JS thread at all, at the cost of coupling the
  native code to Reanimated's internal runtime API, which changes between major versions.
  The JS-side binding costs one assignment per update and works with any Reanimated 3 or 4.
- **Reporting region instead of camera.** Region is the SDK's own derivation and diverges
  between MapKit and Google when the map is tilted or rotated; overlays want heading, pitch
  and zoom, which only the camera carries.
