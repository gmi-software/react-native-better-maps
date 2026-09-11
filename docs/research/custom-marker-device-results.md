# Physical iPhone experiment, 2026-09-11

> **Camera-workload error:** these initial series passed `1200` to a duration measured in seconds. They are not valid moving-camera acceptance runs. Retained numbers describe internal JSX animation under that faulty camera workload. Version 3 corrects this to `1.2` seconds and records camera endpoints.

## Build and workload

- iPhone 15 Pro, iOS 26.6 (23G5043d), Release, RN 0.86 / Reanimated 4.5.0 / Nitro 0.35.10, MapKit. Library native source matches commit `3085c91`.
- `CADisableMinimumFrameDurationOnPhone` enabled; maximum reported refresh 120 Hz. Low-power mode was off and the app active at every recorded endpoint.
- 36 cases: 10/50/200 submitted markers, four modes, three passes, alternating mode order. Each recorded case includes four camera animations and about six seconds of display callbacks.
- All live-host cases reported the requested number mounted and visible at both endpoints. Descriptor pins retain SDK collision/culling behavior, so submitted counts are not a guarantee of equal rendered pin counts.
- Thermal state began at fair (1) and became serious (2), remaining serious in pass 3. Results are retained across that transition.
- An Animation Hitches + Points of Interest recording covered early cases. It failed during finalization with a DTKTraceTapMessageHandler assertion, so it provides no usable presentation evidence. One accessibility verification overlapped the first pins case. These cases must not be described as uninstrumented.
- Harness version 1 emitted both `transform` and `width` from its animated style (the inactive property stayed constant). The subsequent control experiment emits only the property being animated. Raw version-1 results remain separate.

## Main-thread callback results

These are CADisplayLink callback diagnostics, **not presented map/GPU FPS**. Ranges span all three passes; p95 is the worst per-case p95.

| Content | Count | Callback Hz range | Worst p95 ms |
| --- | ---: | ---: | ---: |
| pins | 10 | 116.5–119.8 | 8.34 |
| live-static | 10 | 119.6–120.0 | 8.34 |
| live-transform | 10 | 119.6–120.0 | 8.34 |
| live-layout | 10 | 119.0–120.0 | 8.34 |
| pins | 50 | 119.6–120.0 | 8.34 |
| live-static | 50 | 119.6–119.6 | 8.34 |
| live-transform | 50 | 119.8–120.0 | 8.34 |
| live-layout | 50 | 119.5–120.0 | 8.34 |
| pins | 200 | 119.6–119.8 | 8.34 |
| live-static | 200 | 119.6–120.0 | 8.34 |
| live-transform | 200 | 86.2–120.0 | 24.59 |
| live-layout | 200 | 36.1–68.0 | 50.01 |

The unrestricted acceptance target is **not met**: 200 animated-width markers exceed the 8.33 ms main-thread interval in all passes, and 200 transformed markers regress in the hot third pass. Static live hosts and the 10/50-marker cases stayed close to the descriptor baseline. This does not establish a universal safe count for arbitrary JSX.

The follow-up experiment compares the same animated JSX in ordinary screen overlays against geographic hosts to isolate intrinsic React Native animation work from marker projection/hosting. It also retries presentation capture with shorter Game Performance Overview traces.

[Raw samples and per-case diagnostics](../../experiments/custom-markers/results/iphone-15-pro-run-1.json) · [Reproduction and limitations](../../experiments/custom-markers/README.md)

## Functional and native checks

- Physical iPhone: live JSX appeared, a marker Pressable updated its own state while the map press count stayed unchanged, and removing the map removed its live hosts. Camera motion and rotations run in the automated scenario; exact presentation synchronization still needs trace/visual acceptance.
- Actual UIKit host sources: anchor/projection, hit testing, culling/reentry, unmount/map isolation, surface replacement, and rendered clipping checks passed.
- Android: Kotlin compilation, C++/JNI arm64 compilation, and 16 native unit tests passed, including ScrollView gesture ownership and cancellation/replay. No Android hardware performance result is claimed.
- Package: 32 Jest tests and 51 Bun tests passed; lint, typecheck, library build, and example TypeScript checks passed.
