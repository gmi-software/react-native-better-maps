# Custom marker experiments

This is an isolated, optimized UIKit CPU microbenchmark. It does **not** run React Native, Nitro, MapKit, or Google Maps, and does **not** measure presented FPS. The snapshot comparison is separate from the live Fabric implementation now included in the package.

## Reproduce

Requires Xcode and an already booted iOS Simulator. No JS dependencies, API keys, signing team, or package/example rebuild are required.

```sh
bash experiments/custom-markers/run-ios-simulator.sh booted experiments/custom-markers/results/local-run-1.json
bash experiments/custom-markers/run-ios-simulator.sh booted experiments/custom-markers/results/local-run-2.json --reverse
```

The runner builds a separate `software.gmi.nitromaps.snapshotbench` app in a temporary directory, installs it, launches it, copies its JSON result, and terminates it. It leaves that experiment app installed. The temporary build is removed. Each run has a 180-second result timeout after launch. The simulator must stay available and the experiment app foregrounded during measurement.

## Workload

- A mounted 96 × 48 point rounded white UIView, circular colored avatar placeholder, and price UILabel.
- Explicit 3×, standard-range raster: 288 × 144 pixels, 165,888 bytes (162 KiB) per image.
- Fixed frames, no shadows, downloaded assets, React reconciliation, or Yoga layout.
- Reuses one already mounted template and renderer, changing price on each capture.
- 1, 10, 50, or 200 operations per synchronous main-thread batch.
- Three unreported warmup batches and 20 recorded batches per scenario; 10 ms run-loop gaps between batches.
- Run 2 reverses job order to expose order/warmup sensitivity. This is a small sample, not a confidence interval.
- Raw samples, median, nearest-rank p95, maximum, dimensions, checksum, and environment metadata are saved to JSON.

Variants:

1. `cached-image-assignment`: assigns already prepared images to detached UIImageViews, rotating image identity between batches. Measures CPU setter/reference work only, **not** SDK `setIcon`, texture upload, view composition, or GPU cost.
2. `layer`: updates text and snapshots using `CALayer.render(in:)`, returning a UIImage in memory.
3. `hierarchy`: updates text and calls `drawHierarchy(afterScreenUpdates: true)` inside a renderer. This includes that API's synchronization behavior. It does **not** measure the internal Google `iconView` implementation.
4. `layer-png-decode`: layer snapshot, PNG encode, UIImage decode, and forced preparation for display. No file I/O or bridge/base64 transport is included. Illustrates avoidable image conversion cost, not an exact measurement of `react-native-view-shot`.

Captures intentionally happen sequentially within a batch. This models a burst of appearance work on one main thread, **not** a frame scheduler or 200 simultaneously mounted RN trees. The last checksum consumes all results. Successful hierarchy captures and decoded images are asserted.

## Recorded results, 2026-09-11

Xcode 26.6 (17F113), optimized Swift, iOS Simulator 26.5, iPhone 17 Pro Max simulator (`iPhone18,2`). The simulator reports a **60 Hz** maximum; it cannot validate 120 FPS. No physical device was available during these two initial snapshot runs. Subsequent live-host device validation is recorded separately.

Median milliseconds per batch, shown as **run 1 / run 2**:

| Operations | Cached image assignment |  Layer snapshot | Hierarchy snapshot | Layer + PNG + decode |
| ---------: | ----------------------: | --------------: | -----------------: | -------------------: |
|          1 |           0.061 / 0.080 |   0.470 / 0.872 |      6.830 / 9.841 |        1.456 / 2.738 |
|         10 |           0.103 / 0.202 |   2.331 / 3.456 |    39.656 / 47.318 |      10.102 / 10.253 |
|         50 |           0.640 / 0.265 |   9.960 / 9.641 |  187.526 / 211.161 |      51.956 / 47.432 |
|        200 |           0.853 / 2.134 | 37.301 / 35.788 |  722.918 / 797.074 |    201.881 / 187.313 |

The layer-snapshot p95 for 50 operations was 11.108 / 10.052 ms; for 200 it was 38.944 / 37.126 ms. See [run 1](results/ios-simulator-run-1.json) and [run 2](results/ios-simulator-run-2.json) for all samples.

## Interpretation and limits

An 8.33 ms interval is the entire 120 Hz display budget, not a marker-only allowance. In both runs, batching 50 simple layer captures exceeded that interval before any map, RN, upload, or GPU work. This makes “snapshot every animated marker every frame” a poor default architecture. It does **not** establish a universal safe marker count, a device speed ratio, or the cost of Google SDK-managed snapshots.

The cheaper layer API also has different rendering semantics: it is not a universal capture of presentation-layer animations or every RN/Skia/Metal/video/blur subtree. Faster capture is useful only if it reproduces the requested content. This experiment checks execution and dimensions, not pixel-perfect fidelity across those view types.

Cached appearances eliminate repeated capture work; they do not animate arbitrary internal JSX. The live Fabric prototype and device harness now provide a separate experiment. A UIKit-only snapshot experiment cannot measure its performance.

At this raster size, 200 unique CPU images represent about 31.6 MiB; 1,000 represent about 158.2 MiB before SDK/GPU copies, host views, caches, or allocator overhead. A cache must have a byte budget and shared resource identity. Pre-rendering every animation frame can trade CPU for excessive memory.

See [architecture recommendation](../../docs/research/custom-marker-performance.md) and [SDK sources](../../docs/research/custom-marker-sdk-sources.md).

## Live Fabric host checks

```sh
bash experiments/custom-markers/run-ios-simulator.sh booted experiments/custom-markers/results/native-host-checks.json --host-checks-only
```

This compiles the actual `NitroMapContainerView` and `NitroMarkerContentView` implementations with lightweight coordinate types. It checks projection/anchor updates, transformed child hit testing, culling/reentry, invalid projection, unmount, map isolation, SDK surface replacement, and raster clipping of a scaled child. It does not replace React Native runtime testing.

Android gesture regression tests use Robolectric with the actual container, a native `ScrollView`, and a recording map surface. They exercise the first move beyond touch slop, cancellation/replay to the SDK, and disabled map scrolling:

```sh
cd example/android
./gradlew :react-native-better-maps:testDebugUnitTest --max-workers=2
```

## Release device A/B harness

Build the example with `EXPO_PUBLIC_MARKER_VIEW_BENCHMARK=1`, then use **Run A/B**. The benchmark keeps the display awake while this screen is mounted. It compares existing descriptor pins with live static JSX, Reanimated child transforms, and Reanimated child width changes. Each marker has fixed 96 x 48 point bounds, a colored glyph, text, and a stateful Pressable. The same coordinate set and four native camera animations are used for each case. Three passes alternate case order at 10/50/200 mounted markers.

Counts describe submitted markers; provider pin collision/culling differs from live views. iOS recordings include the mounted/visible live-host census at the start and end, active-app state, low-power mode, and thermal state (0 nominal, 1 fair, 2 serious, 3 critical). These are endpoint checks, not a per-frame visibility census. Warmup and JS serialization/logging occur outside the recorded interval.

The example-only FrameStats module was adapted from [PR #66](https://github.com/gmi-software/react-native-better-maps/pull/66). On iOS it pairs each elapsed callback interval with the preceding requested deadline and records signposted intervals named `MarkerBenchmark`. This diagnoses main-thread callback cadence; it cannot prove presented map/GPU FPS. Use the Animation Hitches template plus Points of Interest, without a debugger attached. Trace and untraced runs must be distinguished when interpreting overhead.

Raw iOS rows are appended to `Documents/marker-view-benchmark.jsonl` in the example app container. Extract and summarize them with:

```sh
xcrun devicectl device copy from --device YOUR_DEVICE --domain-type appDataContainer --domain-identifier com.nitromaps.example --source Documents/marker-view-benchmark.jsonl --destination /tmp/marker-view-benchmark.jsonl
python3 experiments/custom-markers/summarize-rn-benchmark.py /tmp/marker-view-benchmark.jsonl --suite primary --workload-version 3 --output /tmp/marker-view-summary.json
```

The raw file intentionally appends across runs and can survive app upgrades. Separate repeated runs before summarizing; the suite/version filters prevent mixing different workloads but do not identify individual runs. The summarizer rejects version-3 rows whose camera endpoint validation failed. Preserve raw samples, workload parameters, device/OS/build identity, and Instruments evidence before drawing a performance conclusion.

The initial `iphone-15-pro-run-1.json` and `iphone-15-pro-control.json` used an incorrect camera duration of 1200 seconds. They are retained as faulty-workload diagnostics, **not moving-camera acceptance evidence**. Harness version 3 uses 1.2 seconds and saves camera endpoints. The v2 control separates transform and width properties and compares ordinary fixed screen overlays against geographic hosts.

### Cluster workload (v4)

The **Clusters** button runs three alternating passes of descriptor clusters and static/transform/layout JSX clusters at 200 and 1000 input points. Each route moves through zoom 14 → 17 → 17 → 14 while panning/rotating, exercising expansion and regrouping. At 1000 points the longitude spacing is reduced to keep the dataset footprint comparable to 200 points. Native endpoint host counts describe the rendered display set; the input count no longer equals mounted JSX views.

Use `--suite cluster --workload-version 4` when extracting these runs. The renderer's cluster Pressable calls the supplied `onPress` helper to expand bounds. Separately verify expansion, individual interaction, regrouping, removal and provider replacement outside recorded timing windows. v3 results predate this integration and remain the unclustered design checkpoint.
