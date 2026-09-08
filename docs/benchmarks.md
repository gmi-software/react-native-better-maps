# Benchmarks

The example app ships a benchmark harness that measures what the performance
audit could only estimate: main-thread frame intervals, JS-thread stalls and
memory while the map is driven through fixed scenarios. It does not ship in the
library; it lives in `example/benchmark` and the local Expo module
`example/modules/frame-stats`.

## What is measured

| Metric          | How                                                                                                                                                                                                                                                                                                                                                                                                   | Where                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Frame intervals | `CADisplayLink` on iOS, `Choreographer.FrameCallback` on Android, both on the main thread. The gap between two callbacks is the frame the user saw; a blocked main thread is one long gap. The interval the display was running at is recorded per frame, so jank is judged against 8.33 ms on a 120 Hz display and against 16.67 ms on a 60 Hz one, and ProMotion rate changes do not count as jank. | `modules/frame-stats`       |
| JS-thread lag   | A timer re-armed every 16 ms; how late it fires is how long the JS thread was busy, for example serializing a marker array during a commit.                                                                                                                                                                                                                                                           | `benchmark/jsLagSampler.ts` |
| Memory          | `phys_footprint` on iOS, PSS on Android, before and after each scenario.                                                                                                                                                                                                                                                                                                                              | `modules/frame-stats`       |

Percentiles use the nearest-rank method. A frame is jank when it is longer than
1.5× the interval the display asked for. Dropped frames are the refresh slots
that passed with nothing drawn.

## Pass / fail

Thresholds scale with the display's refresh rate (`budget = 1000 / Hz`):

| Metric                                     | Limit                                                            |
| ------------------------------------------ | ---------------------------------------------------------------- |
| p50, p95                                   | ≤ budget + 5 % (display-link jitter around the nominal interval) |
| p99                                        | ≤ 1.5 × budget                                                   |
| worst frame                                | ≤ 3 × budget (25 ms at 120 Hz, 50 ms at 60 Hz)                   |
| jank frames                                | ≤ 1 %                                                            |
| JS lag p95 (animated-marker scenario only) | ≤ budget                                                         |

They are implemented in `benchmark/thresholds.ts` and unit-tested with
`cd example && bun test`.

## Scenarios

| ID  | Setup                              | Script                                                                    |
| --- | ---------------------------------- | ------------------------------------------------------------------------- |
| A   | empty map                          | 3 s idle, short pan                                                       |
| B   | 100 markers                        | pan                                                                       |
| C   | 1,000 markers                      | pan                                                                       |
| D   | 10,000 markers                     | pan                                                                       |
| E   | 10,000 markers, clustering on      | zoom sweep across five levels, then pan                                   |
| F   | 10,000 markers                     | ten-leg pan                                                               |
| G   | 10,000 markers                     | zoom sweep                                                                |
| H   | 10,000 markers                     | four heading changes                                                      |
| I   | 1,000 markers                      | 100 of them move at 10 Hz for 5 s through prop updates; JS lag is checked |
| K   | 5,000-point route and 200 polygons | five style changes, then pan                                              |
| L   | 10,000 markers                     | three pan legs, then 5 s idle                                             |

Scenario J (live location) is not scripted: it needs location permission and a
GPS feed. Use the simulator's location menu with the manual recorder.

The scripted scenarios move the camera with `animateCamera`. That exercises the
same native camera path as a gesture on MapKit and Android, but on the iOS
Google provider the live marker refresh during movement only runs for real
gestures, so use the manual recorder or the Maestro flow there.

## Running

```bash
EXPO_PUBLIC_BENCHMARK=1 bun example ios --port 8082
EXPO_PUBLIC_BENCHMARK=1 bun example android --port 8082
```

`EXPO_PUBLIC_BENCHMARK` is inlined at bundle time; the demo app is unchanged
without it. Use a release build and a physical device for numbers you intend to
keep. Simulators and emulators run at 60 Hz with a different GPU and CPU and
only prove that the harness works.

In the app, "Run all" runs every scenario in order, "Run X" runs the selected
one, "Record" starts a manual recording for real gestures. Each result is
printed as one JSON line:

```text
[benchmark] {"id":"D-markers-10k","frames":{"p95":8.4,...},...}
```

In a debug build the line shows in Metro's terminal. Every build also writes it
to the system log, which is how release builds are harvested:

```bash
xcrun simctl spawn booted log stream --predicate 'eventMessage contains "[benchmark]"'
adb logcat -s NitroMapsBenchmark
```

"Share JSON" exports the whole run through the system share sheet, and
`node example/scripts/benchmark-table.mjs <log file>` turns captured lines into
the Markdown table used below.

### Maestro

```bash
maestro test example/maestro/benchmark-run-all.yaml   # every scripted scenario
maestro test example/maestro/benchmark-pan.yaml       # real-gesture pan on scenario D
```

The flow selects scenario D, starts the manual recorder, performs four swipes
and stops. Maestro has no pinch gesture, so zoom runs stay manual.

### 120 Hz on iPhone

`CADisplayLink` is capped at 60 Hz on iPhone unless the app opts in, so
`example/app.json` sets `CADisableMinimumFrameDurationOnPhone`. Without it a
ProMotion device reports a 60 Hz budget and hides half the frames.

## Baselines

No device numbers are recorded yet. The first accepted run on a 120 Hz iPhone
and a 120 Hz Android device becomes the baseline table here; until then the
audit's estimates stand and every pass/fail line the harness prints is
informational.

### Harness smoke run (not a device baseline)

iPhone 17 Pro simulator, iOS 26.5, release build, MapKit provider, 60 Hz, on an
Apple Silicon Mac. Recorded 2026-09-08 with this harness, evaluated with the thresholds above. The point
of this table is that the harness produces the numbers; a simulator says nothing
about a phone's GPU or CPU. The failures it does show are the ones the audit
predicted: p99 climbs to two frames on the clustered zoom sweep and on rotation,
and the worst frame is 80 ms during rotation.

| Scenario           | Result   | FPS | p50     | p95     | p99     | Worst | Jank  | JS lag p95 | RSS Δ   |
| ------------------ | -------- | --- | ------- | ------- | ------- | ----- | ----- | ---------- | ------- |
| A-empty-idle       | fail (1) | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 56 ms | 0.9 % | 1.1 ms     | +111 MB |
| B-markers-100      | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 47 ms | 0.7 % | 1.1 ms     | +66 MB  |
| C-markers-1k       | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 42 ms | 0.3 % | 1.1 ms     | +66 MB  |
| D-markers-10k      | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 44 ms | 0.7 % | 1.1 ms     | +66 MB  |
| E-clustered-10k    | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 34 ms | 1.7 % | 1.2 ms     | +107 MB |
| F-pan-10k          | pass     | 59  | 16.7 ms | 16.7 ms | 24.6 ms | 42 ms | 1.0 % | 1.2 ms     | +70 MB  |
| G-zoom-10k         | fail (2) | 58  | 16.7 ms | 16.7 ms | 33.4 ms | 35 ms | 3.7 % | 1.2 ms     | +83 MB  |
| H-rotate-10k       | fail (3) | 58  | 16.7 ms | 16.7 ms | 40.0 ms | 80 ms | 2.1 % | 1.2 ms     | +74 MB  |
| I-animated-markers | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.1 ms     | -6 MB   |
| K-shapes           | pass     | 59  | 16.7 ms | 16.7 ms | 19.4 ms | 47 ms | 0.9 % | 1.3 ms     | +88 MB  |
| L-idle-after-pan   | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 45 ms | 0.6 % | 1.1 ms     | +41 MB  |

- A-empty-idle: worst frame 55.59 ms > 50.00 ms
- E-clustered-10k: p99 33.33 ms > 25.00 ms; jank 1.73% > 1%
- G-zoom-10k: p99 33.35 ms > 25.00 ms; jank 3.69% > 1%
- H-rotate-10k: p99 40.05 ms > 25.00 ms; worst frame 80.45 ms > 50.00 ms; jank 2.08% > 1%

### Harness smoke run, Android emulator (not a device baseline)

Android emulator, API 35, arm64, Google Maps provider, 60 Hz, on the same Mac.
Debug build with the JS bundle served by Metro, so JS-thread numbers include
dev-mode overhead and are not comparable with the iOS table; frame intervals are
measured natively and are unaffected. Recorded 2026-09-08. An emulated GPU
exaggerates the marker add/remove churn the audit described: the worst frames on
the 10k scenarios are the diff applies after each camera move.

| Scenario           | Result   | FPS | p50     | p95     | p99      | Worst  | Jank   | JS lag p95 | RSS Δ  |
| ------------------ | -------- | --- | ------- | ------- | -------- | ------ | ------ | ---------- | ------ |
| A-empty-idle       | fail (3) | 59  | 16.7 ms | 16.7 ms | 33.3 ms  | 67 ms  | 1.4 %  | 22.7 ms    | -21 MB |
| B-markers-100      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms  | 33 ms  | 1.0 %  | 26.5 ms    | -31 MB |
| C-markers-1k       | fail (4) | 47  | 16.7 ms | 50.0 ms | 100.0 ms | 133 ms | 12.1 % | 69.2 ms    | -98 MB |
| D-markers-10k      | fail (4) | 34  | 16.7 ms | 66.7 ms | 233.3 ms | 850 ms | 12.3 % | 36.7 ms    | +38 MB |
| E-clustered-10k    | fail (4) | 29  | 16.7 ms | 83.3 ms | 500.0 ms | 717 ms | 10.6 % | 179.8 ms   | -83 MB |
| F-pan-10k          | fail (3) | 54  | 16.7 ms | 16.7 ms | 66.7 ms  | 250 ms | 3.6 %  | 75.2 ms    | +66 MB |
| G-zoom-10k         | fail (4) | 45  | 16.7 ms | 50.0 ms | 133.3 ms | 150 ms | 11.1 % | 96.9 ms    | -39 MB |
| H-rotate-10k       | fail (3) | 56  | 16.7 ms | 16.7 ms | 33.3 ms  | 117 ms | 3.6 %  | 28.6 ms    | -35 MB |
| I-animated-markers | fail (3) | 59  | 16.7 ms | 16.7 ms | 33.3 ms  | 33 ms  | 2.0 %  | 33.7 ms    | -46 MB |
| K-shapes           | fail (3) | 59  | 16.7 ms | 16.7 ms | 33.3 ms  | 50 ms  | 1.3 %  | 46.3 ms    | -64 MB |
| L-idle-after-pan   | fail (4) | 44  | 16.7 ms | 50.0 ms | 166.7 ms | 300 ms | 9.0 %  | 125.8 ms   | +59 MB |

- A-empty-idle: p99 33.33 ms > 25.00 ms; worst frame 66.67 ms > 50.00 ms; jank 1.44% > 1%
- C-markers-1k: p95 50.00 ms > budget 17.50 ms; p99 100.00 ms > 25.00 ms; worst frame 133.33 ms > 50.00 ms; jank 12.15% > 1%
- D-markers-10k: p95 66.67 ms > budget 17.50 ms; p99 233.33 ms > 25.00 ms; worst frame 850.00 ms > 50.00 ms; jank 12.30% > 1%
- E-clustered-10k: p95 83.33 ms > budget 17.50 ms; p99 500.00 ms > 25.00 ms; worst frame 716.67 ms > 50.00 ms; jank 10.62% > 1%
- F-pan-10k: p99 66.67 ms > 25.00 ms; worst frame 250.00 ms > 50.00 ms; jank 3.63% > 1%
- G-zoom-10k: p95 50.00 ms > budget 17.50 ms; p99 133.33 ms > 25.00 ms; worst frame 150.00 ms > 50.00 ms; jank 11.11% > 1%
- H-rotate-10k: p99 33.33 ms > 25.00 ms; worst frame 116.67 ms > 50.00 ms; jank 3.65% > 1%
- I-animated-markers: p99 33.33 ms > 25.00 ms; jank 2.01% > 1%; JS lag p95 33.68 ms > budget 17.50 ms
- K-shapes: p99 33.33 ms > 25.00 ms; worst frame 50.00 ms > 50.00 ms; jank 1.33% > 1%
- L-idle-after-pan: p95 50.00 ms > budget 17.50 ms; p99 166.67 ms > 25.00 ms; worst frame 300.00 ms > 50.00 ms; jank 9.01% > 1%

## Profiling markers

The library emits `os_signpost` intervals (iOS, subsystem `com.nitromaps`,
category `MarkerPipeline`) and `android.os.Trace` sections (Android, prefix
`NitroMaps.`) around the marker fingerprint, the spatial index build, the
viewport compute and the diff apply. They show up in Instruments' Points of
Interest track and in Perfetto, and cost nothing when no tracer is attached.
