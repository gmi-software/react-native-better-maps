# Physical iPhone experiment, 2026-09-11

The unrestricted **arbitrary JSX at 120 FPS** target is not met. Live Fabric hosts avoid bitmap snapshots and preserve child state/animations, but arbitrary child layout can exceed the frame budget. Main-thread display callbacks and actual map presentation are separate measurements.

## Corrected moving-camera workload (v3)

- iPhone 15 Pro, iOS 26.6 beta (23G5043d), Release, RN 0.86 / Reanimated 4.5.0 / Nitro 0.35.10, MapKit. Build source: `fc8fd56`; subsequent changes only analyze/document these results.
- 36 cases: 10/50/200 submitted markers, four modes, three passes with alternating mode order. Descriptor pins are the control in the same binary; this is not a separately built pre-change release comparison. SDK pin collision/culling can make the rendered count differ.
- Four camera animations per case, each **1.2 seconds**, spaced 1.5 seconds apart. Every case reached its checked final coordinate and 36-degree heading. Warmup/remount and logging are outside the recorded interval.
- Fixed 96 × 48 point JSX badges contain text, a glyph, and a stateful Pressable. Transform mode animates child rotation; layout mode animates child width. Each style returns only its animated property. No Reanimated global performance flags were enabled.
- App active and low-power mode off at all endpoints. Thermal state stayed fair (1) throughout this series. Every live case mounted the requested count. With 200 hosts, endpoint visible counts changed from 200 to 190 as the camera moved; 10/50 remained fully visible. Counts are not a per-frame census.
- Metal traces overlapped portions of passes 1 and 2. An accessibility snapshot was requested around the final case and failed during local disk pressure. Treat this as an instrumented exploratory series, not an uninstrumented acceptance run.

## Main-thread callback diagnostics

Ranges span three passes; p95 is the worst per-case p95. These numbers **do not represent presented map/GPU FPS**.

| Content        | Count | Callback Hz range | Worst p95 ms |
| -------------- | ----: | ----------------: | -----------: |
| pins           |    10 |       119.1–119.3 |         8.34 |
| live-static    |    10 |       119.2–119.5 |         8.34 |
| live-transform |    10 |       118.5–119.3 |         8.34 |
| live-layout    |    10 |       119.3–119.5 |         8.34 |
| pins           |    50 |       119.3–119.5 |         8.34 |
| live-static    |    50 |       118.8–119.3 |         8.34 |
| live-transform |    50 |       120.0–120.0 |         8.34 |
| live-layout    |    50 |       119.8–120.0 |         8.34 |
| pins           |   200 |       119.3–119.3 |         8.34 |
| live-static    |   200 |       119.3–119.3 |         8.34 |
| live-transform |   200 |       117.5–119.5 |         8.34 |
| live-layout    |   200 |         51.4–54.8 |        35.72 |

[Raw v3 samples and per-case diagnostics](../../experiments/custom-markers/results/iphone-15-pro-v3-primary.json) · [Reproduction](../../experiments/custom-markers/README.md)

## Same-JSX control (v3)

Twelve additional cases compare 200 fixed screen overlays against 200 geographic hosts, with the same badge and animation. All routes passed; endpoint thermal state remained fair. Overlays use fixed screen positions and do not match geographic visibility/overlap exactly, so this isolates a workload cost rather than providing a perfectly matched GPU control. A short Metal trace overlapped the final pass.

| Content        | Ordinary JSX callback Hz | Marker callback Hz |
| -------------- | -----------------------: | -----------------: |
| Child rotation |              119.5–119.8 |        117.2–118.7 |
| Child width    |                51.0–52.8 |          52.2–52.9 |

The width workload also fails the 120 Hz callback budget without geographic hosts. Marker rotation adds measurable tail latency (up to 2.24% late callbacks versus 0.28% in the ordinary overlay control). These results do not justify promising no cost for arbitrary JSX.

[Raw v3 control samples](../../experiments/custom-markers/results/iphone-15-pro-v3-control.json)

## Presentation diagnostics

A completed 15-second Metal System Trace exposed app-associated displayed surface intervals. In the moving-camera capture, 639 of 677 such intervals were approximately 16.7 ms and 11 were approximately 8.3 ms. A separate 2-second synthesized pan over 200 descriptor pins produced 128 app-associated intervals: 125 near 16.7 ms and one near 8.3 ms. Both captures also include idle/transition intervals; neither is a matched, per-case 120 FPS acceptance comparison. The descriptor gesture control did not reproduce a sustained 120 FPS map baseline under these device conditions.

[Extracted app-surface timing rows](../../experiments/custom-markers/results/iphone-15-pro-v3-surface-diagnostics.json) retain starts/durations without device identifiers. The source schemas are `displayed-surfaces-interval`, filtered to narratives naming the example application. These surface timings do not measure the separate React Native JSX composition layer.

The longer 45-second labeled Metal capture failed with exit 133 during local disk pressure and left an unusable trace; it contributes no presentation evidence. A shorter labeled control capture completed. Earlier Animation Hitches capture failed with a DTKTraceTapMessageHandler assertion; Game Performance Overview provided no Metal frame rows, and its legacy 60 FPS estimate was not used as proof.

Apple documents adaptive refresh arbitration rather than a guaranteed requested rate: [ProMotion guidance](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays). A matched baseline/candidate presentation run under reproducible 120 Hz map conditions remains required.

## Clustering scope

The experiments above intentionally disable clustering to expose the cost of fully expanded markers. They do not measure a clustered production workload. The requested feature also requires custom JSX clusters, native grouping, and tests for cluster expansion/collapse; that acceptance gate remains open in this recorded build.

## Invalid earlier workloads

The original v1 primary and v2 JSX-control series passed `1200` to a duration measured in seconds. They cannot establish moving-camera performance. Their raw files remain available for provenance: [v1 primary](../../experiments/custom-markers/results/iphone-15-pro-run-1.json), [v2 control](../../experiments/custom-markers/results/iphone-15-pro-control.json). Version 1 also returned both width and transform in its animated style; versions 2/3 return only the animated property. Do not pool these series.

## Functional and build checks

- Physical iPhone: live JSX appeared, a marker Pressable updated its state while the map press count stayed unchanged, and unmount removed its live hosts. All 36 corrected camera routes passed endpoint validation. Exact marker/map presentation synchronization is not established by endpoints.
- Actual UIKit host sources: anchor/projection, hit testing, culling/reentry, unmount/map isolation, surface replacement, and rendered clipping checks passed.
- iOS Release builds passed with the optional Google provider both disabled and enabled (Google Maps SDK 10.15.0). Runtime measurements here use MapKit only.
- Android: Kotlin compilation, C++/JNI arm64 compilation, and 16 native tests passed, including ScrollView ownership and cancellation/replay. The example FrameStats module also compiled. Android hardware and Google iOS runtime acceptance remain open.
- Package: 83 Bun tests passed after merging the main-branch test runner migration. Codegen, lint, package/provider typechecks, library build, and example TypeScript checks passed. The generated compatibility patch was checked for idempotence.
