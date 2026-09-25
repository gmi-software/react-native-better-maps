# Android emulator investigation, 2026-09-25

The reported stuttering was reproduced in the example's **Custom markers** screen. This screen renders 12 image-based SDK marker descriptors, not the opt-in live JSX `MarkerView` benchmark. The comparison screen, **Landmarks**, renders five ordinary markers and uses a different camera region. Neither screen validates animated JSX or custom clusters.

## Environment and method

- Pixel 9 Pro arm64 emulator, 1280 × 2856, density 480, 60 Hz display; Apple M2 Pro host.
- Initial installed application was debuggable and connected to Metro. SurfaceFlinger reported ANGLE/SwiftShader software rendering despite `hw.gpu.mode=auto`.
- Source baseline: `2a96412404e22c45f8713988d2ccb4c311b5a354`. The Release candidate changes only the library's Gradle Codegen source root.
- Each capture included two agent-device pans: `(640,1300)` by `(0,-500)` over 3000 ms, followed by `(640,1000)` by `(0,500)` over 3000 ms. Measurements used agent-device 0.20.0 Perfetto capture and its Android gfxinfo summary. Initial captures include longer idle gaps between tool calls; subsequent captures batch the two gestures.
- No builds or native unit tests ran during the reported gesture captures. These are exploratory runs, not a randomized acceptance benchmark.

## Results

| Build / renderer      | Screen                           | Gfxinfo late frames | Percentage |
| --------------------- | -------------------------------- | ------------------: | ---------: |
| Debug / SwiftShader   | Custom markers                   |           167 / 202 |      82.7% |
| Debug / SwiftShader   | Landmarks                        |           173 / 212 |      81.6% |
| Same Debug / host GPU | Custom markers                   |           105 / 252 |      41.7% |
| Release / host GPU    | Custom markers, first capture    |             2 / 386 |       0.5% |
| Release / host GPU    | Landmarks, first capture         |           104 / 368 |      28.3% |
| Release / host GPU    | Landmarks, repeated gestures     |             3 / 383 |       0.8% |
| Release / host GPU    | Custom markers, repeated capture |             4 / 380 |       1.1% |

The first Release Landmarks result is retained: this workload has warmup/host variability, and the best result alone is insufficient evidence. The repeat did not remount Landmarks; Custom markers was remounted before its repeat. Counts are Android gfxinfo deadline diagnostics, **not measured map FPS**.

Perfetto inspection of the custom-marker captures found average main-thread `postAndWait` spans of 62.15 ms with software rendering, 3.74 ms with the same Debug binary on host GPU, and 1.17 ms in the first Release capture. The software capture's RenderThread and GL-Map CPU totals exceeded JS CPU time substantially. This supports a major emulator rendering bottleneck; it does not establish zero cost for custom markers. The Release FrameTimeline also reports buffer stuffing, so low gfxinfo deadline misses must not be presented as a complete latency assessment.

## Changes and validation

- Restarted the existing AVD with `-gpu host -no-snapshot-load`, retaining its data. SurfaceFlinger then identified **Apple M2 Pro**. Persisted `hw.gpu.mode=host` locally; no AVD settings are part of the package change. See [Android's graphics acceleration documentation](https://developer.android.com/studio/run/emulator-acceleration).
- Restricted the library's React Native Gradle `jsRootDir` to `../src`. Previously Codegen scanned the package root, picked up installed dependencies and generated React Native core specs inside the maps library, causing `mergeDexRelease` to fail with duplicate `NativeAccessibilityInfoSpec`. A library clean without the source-root correction reproduced the failure. With the correction, the generated schema has no RN modules, as expected for this Nitro library, and the complete arm64 Release APK builds and runs.
- `:react-native-better-maps:testDebugUnitTest`: **21 tests passed**, none failed or skipped. `git diff --check` passed.
- Installed Release with `adb install -r`; left the emulator on Custom markers. Bundled image icons visibly load in Release. The initial Debug logs reject Metro's `10.0.2.2:8081` asset URLs through the remote-image policy and substitute default pins. That separate development-asset issue remains unresolved; the network policy was not relaxed.

Local Perfetto artifacts are retained under `/tmp/android-*.perfetto-trace`, with compact agent-device JSON summaries for the host-GPU captures. They were analyzed using the official [Perfetto trace processor](https://perfetto.dev/docs/reference/trace-processor-cli). Raw traces are not committed because they include broader emulator process metadata.

This investigation addresses the reported emulator slowdown. It does **not** close the original physical-device 120 FPS gate, arbitrary JSX/animation acceptance, Android custom-cluster runtime acceptance, or the emulator's separate 16 KB compatibility warning. The emulator supports 60 Hz only.
