# Projected marker touch validation

## Regression and fix

Before the fix, the native host moved with the map but Fabric measured the marker at its layout origin. React Native's `Pressability` compared a projected touch with an unprojected rectangle. A tap could succeed without movement but cancel after only one point of jitter.

The marker shadow node now reads a thread-safe native projection offset in `getTransform()`. UIKit points and Android density-independent pixels use the same units as Fabric. Hosts clear their registry entries when hidden or detached/unmounted. Unchanged positions skip publication. Camera movement does not send per-frame updates through JavaScript or request Yoga layout.

## Reproduction

Build the example in Release with `EXPO_PUBLIC_MARKER_TOUCH_CHECK=1`. This flag selects `example/marker-view-benchmark/MarkerTouchCheck.tsx`; rebuild the bundle when changing it.

1. Touch each marker and move by one point/dp before releasing. Each gesture should add one tap, and the measurement panel should report `inside=true`.
2. Hold the nested target for at least 800 ms. It should add a long press without adding a tap.
3. Drag outside the direct target before releasing. Its tap count should stay unchanged.
4. Pan the map from empty space and repeat the small-motion tap at the marker's new position. The measured origin should move with the marker.
5. Unmount and mount the map with the screen's button, then repeat the small-motion tap. Child counters restart on remount.

## Results, 2026-09-29

Release builds passed on the Pixel 9 Pro Android emulator (Google Maps) and iPhone 17 Pro Max simulator, iOS 26.5 (MapKit). Both passed direct/nested small-motion taps, cancellation outside the target, long press, camera reprojection, and map remount checks. Marker interactions left the map press count at zero.

For example, Android's nested target initially measured `(133.3, 446.0, 160, 60)` dp and accepted a touch at `(213.3, 476.0)`. After panning, it measured `(190.3, 477.3, 160, 60)` and accepted `(270.3, 507.3)`. The one-dp gesture incremented the tap counter in both positions.

Automated validation: 93 Bun tests, including three cases using React Native's actual `Pressability` implementation; 22 Android native unit tests; standalone UIKit host checks; package/provider and example typechecks; lint; library build; native Release builds. The generated compatibility patch remained idempotent across 157 files after full Nitrogen generation. The Pressability unit harness supplies measurement data; the simulator/emulator runs above verify the actual native-to-Fabric measurement path.

These are functional checks, not performance acceptance. Google Maps iOS and physical-device interaction were not rerun for this fix. Presented-frame performance and the original 120 FPS acceptance gate remain open; see [device results](custom-marker-device-results.md).
