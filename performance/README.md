# Performance Lab

A reproducible environment for measuring `react-native-better-maps`: fixed
workloads, native frame and memory instrumentation, compile-time timing
probes inside the library, a CLI that runs scenarios on a device and stores
structured results, and a comparison/regression step. It measures; it does
not optimize. Findings live in [PERFORMANCE.md](./PERFORMANCE.md).

## Layout

```text
performance/
├── README.md              this file
├── PERFORMANCE.md         scorecard, bottlenecks, optimization backlog
├── perf.config.ts         suites, regression thresholds, frame budget rules
├── fixtures/              deterministic data generators (seeded PRNG, pinned hashes)
├── scenarios/             workload definitions: markers, camera, mutations, geometry,
│                          clustering, combined, stability
├── app/                   the in-app runner (PerfLabApp, MapHost, metrics, result schema)
├── benchmarks/            JS micro-benchmarks (bun) and native unit-benchmark notes
├── scripts/               `bun perf` CLI, build scripts
└── results/               baseline/ (committed), runs/ and bench/ (local)
```

Native pieces that belong to the lab but must live elsewhere:

- `example/modules/perf-lab/` — a local Expo module: `CADisplayLink` /
  `Choreographer` + `FrameMetrics` frame recorder, memory, CPU, thermal and
  battery readouts, probe drain, result files, system-log lines.
- `package/ios/PerfProbe.swift`, `package/android/.../PerfProbe.kt` — the
  library's timing probes. Compiled in only for profile builds (see below).

## Architecture under test

Verified from the code, not assumed:

```text
JS (React)            <MapView markers={[...]}>  or  <Marker> children
   │                  MapView.tsx collects children (useCollectedOverlays) or
   │                  normalizes the bulk prop (normalizeMarkerDescriptors)
   ▼
React Native Fabric   diffProperties → deepDiffer on every object/array prop
   │                  (JS thread, per commit)
   ▼
Nitro / JSI           HybridMapViewProps parses RawProps: JSIConverter<MarkerDescriptor>
   │                  reads 13 properties per marker into C++ structs
   │                  (JS thread, inside the React commit; skipped when the
   │                  JS array reference is unchanged — CachedProp)
   ▼
Mount (UI thread)     Android: C++ → JNI, one Java MarkerDescriptor + boxed
   │                  fields per marker; iOS: std::vector → Swift [MarkerDescriptor]
   ▼
Kotlin / Swift        HybridMapView → provider adapter → overlay controller:
   │                  fingerprint (hash all markers) → spatial index (background)
   │                  → viewport filter or grid clustering (background)
   │                  → render diff → apply on the main thread
   ▼
Map SDK               Google Maps (Android, iOS opt-in) / MapKit (iOS):
   │                  addMarker / MKAnnotationView, polylines, polygons
   ▼
Rendering / GPU       SDK-owned; observed through frame intervals only
```

There is no library C++ beyond the generated Nitro bindings (`package/cpp` is
empty), so "C++ time" in this lab means Nitro's JSI conversion (measured
inside the JS commit) and the mount-time copy (measured as commit → native
setter latency).

## Build variants

| Variant | Native                      | JS bundle                    | Probes   | Use for                                   |
| ------- | --------------------------- | ---------------------------- | -------- | ----------------------------------------- |
| DEBUG   | debuggable, no optimization | Metro dev bundle (`__DEV__`) | optional | checking that the harness works           |
| RELEASE | optimized                   | production bundle            | off      | shipping; also the cleanest frame numbers |
| PROFILE | optimized                   | production bundle            | on       | every number in PERFORMANCE.md            |

Results record `build.type`, `build.jsDev`, `build.perfProbes`,
`build.hermes` and `build.representative` (true only for release native +
production JS on a physical device). Simulator and debug numbers are labelled
NOT production-representative in every table and must be treated that way.

The lab UI is compiled into the example app only when `EXPO_PUBLIC_PERF_LAB=1`
is set at bundle time; the demo app is unchanged otherwise. Probes are
compiled into the library only with `-PNitroMaps_perfProbes=true` (Android)
or `"betterMaps.perfProbes": "true"` in `example/ios/Podfile.properties.json`
(iOS, adds `-DNITROMAPS_PERF_PROBES`). Without them every probe call site is
an inlined no-op / a folded constant check; release builds carry nothing.

## How to run

### 1. Build and install

```bash
bun install
bun perf build android --install          # release + probes, arm64, installs on the adb device
bun perf build ios --install              # release + probes for the booted simulator
```

`--debug` builds the debug variant, `--no-probes` a plain release. The
scripts run `nitrogen`, `expo prebuild` (if needed), Gradle / `pod install`

- `xcodebuild`. On this machine Gradle needs a JDK 17 (`JAVA_HOME`) and
  CocoaPods a UTF-8 locale; both are exported by the scripts.

For a physical iPhone: open `example/ios/NitroMapsExample.xcworkspace` in
Xcode launched from a shell with `EXPO_PUBLIC_PERF_LAB=1`, pick the Release
build configuration and run on the device. Results then come through the
share sheet or the app's Documents folder (file sharing is enabled).

### 2. Pick and run scenarios

```bash
bun perf list                             # every scenario with group, tags, duration
bun perf devices                          # adb devices + booted simulators
bun perf run markers-10k                  # one scenario
bun perf run markers camera               # whole groups
bun perf run 'camera-fast-pan-*'          # prefix
bun perf run --suite quick                # suites: quick, baseline, full, <group>
bun perf run mutations-10k --repeat 3 --label "before-fix"
bun perf run camera-gesture-pan-10k       # Android: the CLI drives adb swipes
bun perf baseline                         # suite "baseline", stored under results/baseline
```

The CLI opens `nitromapsperf://run?…` on the device, follows the system log
(`adb logcat -s NitroMapsPerfLab` / `log stream --predicate 'subsystem ==
"com.nitromaps.perflab"'`), prints one line per finished scenario, pulls the
run file and writes `results/runs/<runId>-<platform>-<device>/` with
`run.json`, one JSON per scenario and `summary.md`.

Runs can also be started from the lab UI (tap scenarios, Run / Quick /
Baseline) and, for real gestures, with Mount → Record → gesture → Stop.
Every result line the app prints starts with `[perf-lab]`.

### 3. Compare and check

```bash
bun perf compare                          # latest run vs. the matching baseline
bun perf compare results/baseline/android/<dir> results/runs/<dir> --detail
bun perf check                            # thresholds from perf.config.ts, warn only
bun perf check --fail                     # exit 1 on a regression (for CI, once stable)
bun perf report results/runs/<dir>        # Markdown scorecard + step/timeline tables
bun perf report <dir> --digest --transfer # + per-scenario evidence and JS → native transfer tables
bun perf evidence <dir>                   # JSON with the numbers PERFORMANCE.md cites
bun perf scorecard --write                # regenerate the results section of PERFORMANCE.md from results/baseline
```

### 4. Offline benchmarks

```bash
bun perf bench                            # JS micro-benchmarks → results/bench/*.json
bun perf fixtures                         # fixture determinism (pinned hashes)
```

Native pipeline micro-benchmarks (JVM / XCTest) are described in
[benchmarks/native/README.md](./benchmarks/native/README.md).

## What is measured

| Area             | Metric                                                                                                                                                                                                                                                                                                                                                                                      | How                                                                      | Where                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| Frames           | intervals between display callbacks; p50/p90/p95/p99/worst; jank (> 1.5× the interval the display ran at); dropped slots; frames > 50 ms; per-second FPS and its p95/p99 ("bad seconds"); histogram                                                                                                                                                                                         | `CADisplayLink` (opted into 120 Hz) / `Choreographer` on the main thread | `example/modules/perf-lab` |
| Frames (Android) | `FrameMetrics`: UI-thread phases (input, animation, layout, draw), sync, command issue, swap, GPU; missed deadlines                                                                                                                                                                                                                                                                         | window `OnFrameMetricsAvailableListener`                                 | same                       |
| JS thread | JS lag p50/p95/p99/max, busy ratio, long tasks (`PerformanceObserver` `longtask` when the runtime reports it). iOS: gap between `requestAnimationFrame` callbacks minus the frame interval (`lagSource: animation-frame`). Android: delay of a native ping posted to the JS message queue every 8 ms (`lagSource: js-queue-ping`) | `requestAnimationFrame` / `ReactContext.runOnJSQueueThread` | `app/metrics/jsThread.ts`, `example/modules/perf-lab` |
| JS commits       | per `setProps`: setState → layout effect (React render + Fabric shadow commit + Nitro prop parsing)                                                                                                                                                                                                                                                                                         | `MapHost`                                                                | `app/MapHost.tsx`          |
| Bridge           | commit end → native `*.set` span start (mount scheduling + C++→Swift/JNI copy); setter duration                                                                                                                                                                                                                                                                                             | clock-aligned probe spans                                                | `app/runner.ts`            |
| Native           | spans: `markers.set`, `markers.fingerprint`, `markers.indexBuild`, `markers.candidates`, `markers.viewportFilter`, `markers.cluster`, `markers.diff`, `markers.applyDiff` / `applySync`, `marker.visualProps` (Android), `annotation.viewFor` / `didAdd` (MapKit), `polylines.set`, `polygons.set`, `circles.set`, `camera.apply`, `region.apply`; each with thread, count and payload size | `PerfProbe` (also `os_signpost` / `android.os.Trace`)                    | library, profile builds    |
| Memory           | footprint (`phys_footprint` / PSS), resident; Android Java heap, native heap, ART GC count/time/bytes allocated; iOS malloc blocks/bytes in use; at before / after load / after interaction / after cleanup, plus checkpoints                                                                                                                                                               | native module                                                            | `app/metrics/memory.ts`    |
| Allocations (JS) | Hermes `getInstrumentedStats`: bytes allocated, GC count/time, heap size (when the engine exposes them)                                                                                                                                                                                                                                                                                     | `HermesInternal`                                                         | `app/metrics/hermes.ts`    |
| CPU              | process CPU time over wall time, thread count, thermal state, battery, low-power mode                                                                                                                                                                                                                                                                                                       | `getrusage` / `Process.getElapsedCpuTime`                                | native module              |
| Transfer         | prop updates per key, items / coordinates / estimated bytes per update, events received from native                                                                                                                                                                                                                                                                                         | `TransferTracker`                                                        | `app/metrics/transfer.ts`  |
| Load             | mount commit time, mount → `onMapReady`, native spans during load                                                                                                                                                                                                                                                                                                                           | runner                                                                   | `app/runner.ts`            |

Everything that could not be measured is `null` in the JSON and `N/A` in the
tables. Nothing is estimated.

### Limits (be honest about them)

- **JS commit time includes JSI conversion but cannot split it from React.**
  The JSI object → C++ struct parse happens inside the React commit on the
  JS thread. The lab reports the whole commit and, separately, the modeled
  cost of Fabric's `deepDiffer` and of the library's normalization (offline
  benchmarks), so the remainder is attributable to React + Nitro parsing.
- **Bridge copy time is a latency, not a duration.** commit → setter latency
  contains the UI-thread queue wait; a busy UI thread inflates it.
- **Android `FrameMetrics` only covers the app window.** Google Maps draws
  on its own surface, so the window reports a frame only when React Native
  re-renders; during a pure camera move it sees one frame. The Choreographer
  intervals remain the main-thread signal (they catch Fabric mounts, marker
  adds and the JNI copy), but the map's own render rate is not observable
  from inside the app. `adb shell dumpsys SurfaceFlinger --latency <layer>`
  exposes the map surface's last 128 frame timestamps if that is ever needed.
- **iOS allocation churn is not counted.** `malloc_zone_statistics` gives
  blocks in use (retained), not allocation rate; use Instruments
  (Allocations) for churn — workflow below.
- **Simulator and emulator memory numbers include map tile caches** that the
  SDKs size for a desktop-class host; treat `RAM Δ interaction` as a trend
  across scenarios, not as an absolute cost, until a device baseline exists.
- **JS micro-benchmarks run on bun (JavaScriptCore with a JIT)**; they show
  algorithmic scaling and relative cost, not Hermes-on-a-phone cost.
- **Gestures on iOS need a finger or Maestro.** The CLI drives `adb shell
input swipe` on Android only, and adb cannot pinch.
- **Scripted camera moves use `animateCamera`.** On MapKit and Android that
  exercises the same native path as a gesture; on the iOS Google provider
  the live marker refresh only runs for real gestures.
- **Long-task entries** depend on the React Native version exposing them;
  otherwise long tasks are derived from lag samples > 50 ms and labelled so.
- **JS lag is measured differently per platform.** On iOS it is the gap
  between `requestAnimationFrame` callbacks minus the frame interval (zero
  while idle; JS work shorter than a frame is invisible to it). On Android
  React Native dispatches timers and animation frames from the UI thread's
  Choreographer and skips a vsync now and then even when idle (a
  timer-based sampler reads ~18 ms late at rest), so the lab pings the JS
  message queue from a native thread every 8 ms instead and reports how
  long each ping waited. The `camera-idle-*` scenarios show each floor, and
  `JS commit busy` (commit time over duration) is reported for both.
- **A locked or sleeping Android device stalls the run.** The activity is
  paused and React Native pauses JS timers with it. `bun perf run` wakes the
  screen, keeps it on and refuses to start while a secure lock screen is
  showing; unlock the phone by hand first. It also warns when the device has
  no network (map tiles will not load, `onMapReady` can time out).

## Deterministic workloads

Every fixture comes from `fixtures/` with an explicit seed (default
`12345`) through `mulberry32`; `Math.random` is never used. Markers are
Gaussian blobs around Polish cities weighted by population plus 12 % rural
scatter (Warsaw is the densest hotspot), polylines are smooth random walks,
polygons are star-shaped rings with harmonic radius noise. Coordinates are
rounded to 6 decimals so JSON output is byte-stable.
`bun perf fixtures` checks pinned hashes of the generated data; change them
only together with a fresh baseline and a note in PERFORMANCE.md.

## Scenarios

`bun perf list` is the source of truth. Groups:

- **markers** — 100, 1k, 10k, 50k, 100k (heavy) through the bulk prop;
  1k and 10k as `<Marker>` children; 10k with titles + visual props.
- **camera** — idle, slow pan, fast pan, continuous pan, zoom in/out,
  rapid zoom, rotate, pitch, rapid flicks × 0 / 1k / 10k / 50k markers,
  plus real-gesture pan and zoom windows.
- **mutations** — the marker update benchmark at 10k (add 1, remove 1,
  update 1 / 10 / 100 / 1 % / 10 % / 100 %, five repeats each, as steps),
  the same through children at 1k, continuous 10 Hz updates at 1k and 10k.
- **geometry** — polyline 100 / 1k / 10k / 100k points, polygon 100 / 1k /
  10k vertices (restyle + geometry updates + pan), 200 × 50-point polylines,
  200 × 20-vertex polygons.
- **clustering** — 1k / 10k / 50k / 100k clusterable markers: zoom sweep,
  wide pan, 1 % update; `markers.cluster` spans separate compute from apply.
- **combined** — 10k + camera, 10k + clustering + camera, 10k + updates
  while panning, 10k + 10k-point polyline, 10k + 200 polygons, everything.
- **stability** — 5 and 15 minutes of pan / zoom / 1 % updates over 10k
  clustered markers with a checkpoint every minute (FPS, memory, CPU, GC).

## Results format

One `ScenarioResult` per scenario (schema in `app/result.ts`):

```jsonc
{
  "scenario": "camera-fast-pan-10k", "platform": "android", "provider": "google",
  "device": { "model": "RMX3081", "osVersion": "13", "refreshRateHz": 60, "isSimulator": false, … },
  "build": { "type": "release", "jsDev": false, "hermes": true, "perfProbes": true, "representative": true, "caveats": [] },
  "refreshRateHz": 60, "frameBudgetMs": 16.67, "durationMs": 5100,
  "load": { "commitMs": 63.2, "readyMs": 1840, "native": { "byName": { "markers.set": {…} } }, "bridge": {…} },
  "frames": { "fps": { "average": 58.1, "p95": 41.0, "p99": 33.0 }, "frameTimeMs": { "p50": 16.7, "p95": 33.4, "p99": 66.7, "worst": 133.4, "histogram": {…} }, "jankRatio": 0.04, "longFrames": 3, "android": { "phaseSharePct": {…} } },
  "js": { "lagSource": "js-queue-ping", "lagMs": { "p95": 2.1 }, "busyRatio": 0.03, "longTasks": {…}, "commits": { "count": 0 } },
  "bridge": { "commitToNativeMs": null, "setterMs": null },
  "native": { "available": true, "mainThreadMs": 412.5, "backgroundMs": 96.0, "byName": { "markers.applyDiff": { "count": 9, "totalMs": 380.2, "p95Ms": 61.1, "maxMs": 71.0, "items": 2860 } } },
  "memory": { "beforeMB": 180, "afterLoadMB": 231, "afterInteractionMB": 238, "afterCleanupMB": 205, "peakMB": 238, "retainedAfterCleanupMB": 25 },
  "allocations": { "hermes": { "allocatedBytes": 1200000, "gcCount": 2 }, "android": { "javaBytesAllocated": 91000000, "gcCount": 4 } },
  "cpu": { "processCpuMs": 3900, "wallMs": 5100, "percent": 76, "thermalBefore": "none", "thermalAfter": "none" },
  "transfer": { "updates": {}, "payload": {}, "eventsToJs": { "onRegionChange": 0 } },
  "steps": [], "timeline": [], "metrics": {}, "notes": [], "errors": []
}
```

Values above are illustrative of the shape only; real numbers are in
`results/baseline` and PERFORMANCE.md.

## Regression detection

`bun perf check` compares the latest run with the baseline recorded on the
same platform, device and build variant and applies `REGRESSION_THRESHOLDS`
from `perf.config.ts`:

| Metric                | Threshold                     |
| --------------------- | ----------------------------- |
| FPS average           | drop > 5 %                    |
| Frame p95             | increase > 5 %                |
| Frame p99             | increase > 10 %               |
| RAM after interaction | increase > 10 %               |
| JS commit average     | increase > 10 %               |
| Native setter average | increase > 10 %               |
| Jank ratio            | increase > 1 percentage point |

Metrics that are N/A on either side are skipped and listed, never counted.
`check` warns by default and only fails with `--fail`: device runs on a
loaded host vary by several percent run to run, and the baseline has not yet
been shown stable across repeated runs. The recommended path to CI gating:

1. Record the baseline three times on the reference device; keep the median
   run. Widen a threshold if the spread between the three exceeds it.
2. Run `bun perf run --suite quick` on each candidate branch, then
   `bun perf check --fail`.
3. Only then wire the same two commands into a self-hosted job with the
   device attached. Do not gate on simulator/emulator numbers.

## Device matrix

Recommended reference devices (record one baseline per row):

| Platform | Class           | Requirement                                                    | Why                                                                              |
| -------- | --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Android  | modern flagship | 120 Hz display, Android 13+                                    | shows whether the 8.33 ms budget is met; adaptive refresh is tracked per frame   |
| Android  | mid-range       | 60 Hz, 4–6 GB RAM (the Realme RMX3081 in this repo's baseline) | representative of most users; memory pressure shows first here                   |
| iOS      | modern iPhone   | ProMotion (120 Hz), iOS 17+                                    | MapKit at 120 Hz; needs `CADisableMinimumFrameDurationOnPhone` (set in app.json) |
| iOS      | older iPhone    | 60 Hz                                                          | MapKit annotation view cost at 60 Hz                                             |

Before a baseline, check and record (the result file does most of this):

- release native build, production JS bundle (`build.type`, `build.jsDev`);
- Hermes on (`build.hermes`), dev menu and remote debugging off (implied by
  a release build; never run baselines from Metro);
- thermal state `nominal`/`none` (`cpu.thermalBefore`), battery > 50 % and
  charging (`cpu.batteryLevel`, `cpu.batteryState`), low-power mode off;
- screen refresh rate (`device.refreshRateHz`, `device.supportedRefreshRatesHz`)
  and whether the OS is throttling it (some Android devices drop to 60 Hz
  when hot or on battery saver);
- no other apps running; host load matters for emulators and simulators.

## Profiling workflows

The lab tells you _where_ time goes at the granularity of its probes; the
platform profilers tell you _why_. All of these attach to the PROFILE build.

### JS

- **Hermes sampling profiler**: dev menu → "Enable Sampling Profiler" in a
  debug build, or `HermesInternal.enableSamplingProfiler()`; open the trace
  in `chrome://tracing`. Use a debug build only to find _which_ JS function
  is hot, then confirm the cost in a release build with the lab's commit
  timings.
- **React DevTools profiler** for re-render counts of `MapView` (the
  children-based scenarios re-collect on every parent render).
- **Long tasks**: `js.longTasks` in results; the source field says whether
  the runtime reported them or the lag sampler inferred them.

### Android

- **Perfetto / Android Studio system trace**: the probes emit
  `android.os.Trace` sections named `NitroMaps.<span>`; record with
  `python3 record_android_trace -a com.nitromaps.example sched freq gfx view`
  (Perfetto's helper) or Studio's CPU profiler in "System Trace" mode, then
  look at the main thread around `NitroMaps.markers.applyDiff` and the
  `RenderThread` / GPU completion.
- **Android Studio Profiler → Memory**: record allocations during
  `mutations-10k`; sort by allocation count; expect
  `MarkerDescriptor`, boxed `Double`/`Boolean`, `String` (JNI copies) and
  `Object[]` (vararg `renderSignature`) to dominate. `allocations.android`
  in the result gives the totals to compare against.
- **GPU**: `adb shell dumpsys gfxinfo com.nitromaps.example framestats` after
  a scenario for the SDK's own render-thread numbers; the `frames.android`
  phase shares in the result come from the same `FrameMetrics` source.
- **Memory over time**: `adb shell dumpsys meminfo com.nitromaps.example`
  between scenarios; the lab's PSS snapshots are the same number.

### iOS

- **Instruments → Time Profiler** on the simulator or a device: the probes
  appear in the **Points of Interest** track (subsystem `com.nitromaps`,
  category `Pipeline`), so the call tree can be filtered to the interval
  of one `markers.applyDiff` or `markers.cluster`.
- **Instruments → Allocations** with "Record reference counts" off and
  "Allocation type: All heap & anonymous VM": run `mutations-10k`, mark
  generations between steps; expect `std::string` copies from
  `MarkerDescriptor` struct copies, `MapMarkerAnnotation`,
  `MKMarkerAnnotationView` and `Hasher` temporaries.
- **Instruments → Leaks** after `markers-10k` unmounts; the lab's
  `memory.retainedAfterCleanupMB` says how much to look for.
- **Instruments → Energy Log / Thermal State** for the 15-minute stability
  run on a device; `cpu.thermalBefore/After` in the timeline windows records
  the OS thermal state the lab saw.
- **Core Animation FPS** in Instruments cross-checks the display-link
  intervals; MapKit renders on its own threads, so a 120 Hz display link
  with 60 Hz map tiles is normal at rest.

## Keeping the harness out of production

- The lab UI ships only with `EXPO_PUBLIC_PERF_LAB=1` (inlined at bundle
  time; `example/index.js` requires the demo app otherwise).
- Probes compile only with the Gradle property / Podfile property; the
  no-op variants are empty inline functions (Swift) or a folded constant
  check (Kotlin). Release builds without the flag contain no signposts, no
  trace sections and no recording buffers.
- The `perf-lab` Expo module lives in the example app and is not part of
  the published package (`package/package.json` `files` is unchanged).
- Nothing in `package/src` imports from `performance/`.
