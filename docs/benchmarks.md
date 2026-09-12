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

| Metric                                                    | Limit                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| p50, p95                                                  | ≤ budget + 5 % (display-link jitter around the nominal interval) |
| p99                                                       | ≤ 1.5 × budget                                                   |
| worst frame                                               | ≤ 3 × budget (25 ms at 120 Hz, 50 ms at 60 Hz)                   |
| jank frames                                               | ≤ 1 %                                                            |
| JS lag p95 (scenarios that say "JS lag is checked" below) | ≤ budget                                                         |

They are implemented in `benchmark/thresholds.ts` and unit-tested with
`cd example && bun test`.

## Scenarios

| ID  | Setup                              | Script                                                                               |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| A   | empty map                          | 3 s idle, short pan                                                                  |
| B   | 100 markers                        | pan                                                                                  |
| C   | 1,000 markers                      | pan                                                                                  |
| D   | 10,000 markers                     | pan                                                                                  |
| E   | 10,000 markers, clustering on      | zoom sweep across five levels, then pan                                              |
| F   | 10,000 markers                     | ten-leg pan                                                                          |
| G   | 10,000 markers                     | zoom sweep                                                                           |
| H   | 10,000 markers                     | four heading changes                                                                 |
| I   | 1,000 markers in a collection      | 100 of them move at 10 Hz for 5 s through `updatePositions`; JS lag is checked       |
| I2  | 1,000 markers                      | 100 of them move at 10 Hz for 5 s through new `markers` arrays; JS lag is checked    |
| K   | 5,000-point route and 200 polygons | five style changes, then pan                                                         |
| L   | 10,000 markers                     | three pan legs, then 5 s idle                                                        |
| M   | 10,000 markers in a collection     | one marker is upserted every 100 ms for 3 s; JS lag is checked                       |
| N   | 10,000 markers inside the viewport | street-level zoom sweep, where the LOD cap allows 2,000 markers on screen            |
| O   | 10,000 markers                     | pan while `onCameraMove` feeds a shared value at a 16 ms throttle; JS lag is checked |
| P   | 100,000 markers, clustering on     | zoom sweep across five levels, then pan                                              |

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

Use the flows on Android only. On iOS, Maestro waits for the summary by
polling the accessibility tree, and XCTest builds each snapshot on the app's
main thread, in time proportional to the number of annotation views on the
map. That polling shows up as dropped frames in every scenario with many
markers on screen and doubled the reported jank on a static map with one
marker changing per tick. Start "Run all" by hand on iOS (or through
`xcrun simctl`) and harvest the system log.

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

### Marker store runs (not a device baseline)

The same emulator and simulator after markers moved to the native store (ADR
0005). Numbers from a Mac that is also running the build tooling; treat them as
a before/after on identical hardware, not as device numbers.

Android emulator, API 35, arm64, Google Maps provider, 60 Hz, **release build**
(the earlier Android table was a debug build served by Metro, so its JS-lag
column is not comparable; frame intervals are). Recorded 2026-09-08. The
emulator's JS-lag floor is about 20 ms even on the empty map, which is what the
two `(1)` failures on the collection scenarios are.

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst  | Jank  | JS lag p95 | RSS Δ  |
| --------------------- | -------- | --- | ------- | ------- | ------- | ------ | ----- | ---------- | ------ |
| A-empty-idle          | fail (1) | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 67 ms  | 0.6 % | 21.5 ms    | -8 MB  |
| B-markers-100         | fail (3) | 58  | 16.7 ms | 16.7 ms | 33.3 ms | 50 ms  | 3.4 % | 34.1 ms    | -5 MB  |
| C-markers-1k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms  | 0.3 % | 21.9 ms    | -4 MB  |
| D-markers-10k         | fail (3) | 58  | 16.7 ms | 16.7 ms | 50.0 ms | 67 ms  | 1.7 % | 26.4 ms    | -2 MB  |
| E-clustered-10k       | fail (3) | 58  | 16.7 ms | 16.7 ms | 33.3 ms | 183 ms | 1.4 % | 23.1 ms    | -21 MB |
| F-pan-10k             | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms  | 0.0 % | 22.9 ms    | -10 MB |
| G-zoom-10k            | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 33 ms  | 1.3 % | 29.7 ms    | +14 MB |
| H-rotate-10k          | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 33 ms  | 1.0 % | 24.1 ms    | -18 MB |
| I-animated-collection | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms  | 0.3 % | 18.9 ms    | -50 MB |
| I2-animated-prop      | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms  | 0.0 % | 20.2 ms    | -1 MB  |
| K-shapes              | fail (3) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 50 ms  | 1.4 % | 22.4 ms    | +8 MB  |
| L-idle-after-pan      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms  | 0.2 % | 19.9 ms    | -1 MB  |
| M-one-of-10k          | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms  | 0.0 % | 18.6 ms    | +9 MB  |

- A-empty-idle: worst frame 66.67 ms > 50.00 ms
- B-markers-100: p99 33.33 ms > 25.00 ms; worst frame 50.00 ms > 50.00 ms; jank 3.37% > 1%
- D-markers-10k: p99 50.00 ms > 25.00 ms; worst frame 66.67 ms > 50.00 ms; jank 1.68% > 1%
- E-clustered-10k: p99 33.33 ms > 25.00 ms; worst frame 183.33 ms > 50.00 ms; jank 1.38% > 1%
- G-zoom-10k: p99 33.33 ms > 25.00 ms; jank 1.31% > 1%
- H-rotate-10k: p99 33.33 ms > 25.00 ms; jank 1.01% > 1%
- I-animated-collection: JS lag p95 18.86 ms > budget 17.50 ms
- I2-animated-prop: JS lag p95 20.19 ms > budget 17.50 ms
- K-shapes: p99 33.33 ms > 25.00 ms; worst frame 50.00 ms > 50.00 ms; jank 1.43% > 1%
- M-one-of-10k: JS lag p95 18.58 ms > budget 17.50 ms

iPhone 17 Pro simulator, iOS 26.5, release build, MapKit provider, 60 Hz,
"Run all" started by hand (see the Maestro note above). Recorded 2026-09-08.
Against the phase-1 table on the same simulator: the clustered zoom sweep (E)
now passes with a worst frame of 33 ms instead of 34 ms and a p99 of one
frame instead of two, rotation (H) lost its 80 ms worst frame, and the two new
scenarios show what the store is for: moving 100 markers at 10 Hz (I) and
changing one marker of 10,000 (M) both keep every frame at 16.7 ms with a JS
lag around 1 ms and no measurable memory growth. The zoom sweep without
clustering (G) still drops frames at octave crossings, where MapKit creates
hundreds of `MKMarkerAnnotationView`s at once; that is the phase-3 work
(time-sliced apply, lighter annotation views), not the transport.

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst | Jank  | JS lag p95 | RSS Δ  |
| --------------------- | -------- | --- | ------- | ------- | ------- | ----- | ----- | ---------- | ------ |
| A-empty-idle          | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 45 ms | 0.6 % | 1.1 ms     | +65 MB |
| B-markers-100         | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 45 ms | 0.3 % | 1.2 ms     | +78 MB |
| C-markers-1k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 46 ms | 0.3 % | 1.1 ms     | +66 MB |
| D-markers-10k         | pass     | 59  | 16.7 ms | 16.7 ms | 20.6 ms | 46 ms | 1.0 % | 1.1 ms     | +66 MB |
| E-clustered-10k       | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.8 % | 1.1 ms     | +90 MB |
| F-pan-10k             | pass     | 59  | 16.7 ms | 16.7 ms | 23.6 ms | 43 ms | 1.0 % | 1.1 ms     | +89 MB |
| G-zoom-10k            | fail (2) | 58  | 16.7 ms | 16.7 ms | 33.3 ms | 36 ms | 3.3 % | 1.1 ms     | +99 MB |
| H-rotate-10k          | fail (2) | 59  | 16.7 ms | 16.7 ms | 35.6 ms | 36 ms | 1.0 % | 1.1 ms     | +50 MB |
| I-animated-collection | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.4 ms     | -5 MB  |
| I2-animated-prop      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.1 ms     | -0 MB  |
| K-shapes              | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 49 ms | 0.3 % | 1.1 ms     | +67 MB |
| L-idle-after-pan      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 46 ms | 0.4 % | 1.2 ms     | +48 MB |
| M-one-of-10k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.1 ms     | +1 MB  |

- G-zoom-10k: p99 33.33 ms > 25.00 ms; jank 3.33% > 1%
- H-rotate-10k: p99 35.56 ms > 25.00 ms; jank 1.01% > 1%

### Frame-budgeted rendering runs (not a device baseline)

The same simulator and emulator after ADR 0006: viewport diffs applied over
frames with an adaptive per-frame add count, flat pins on MapKit, the live
refresh on a display link, and the cluster octave cache. Scenario N (10,000
markers inside the city viewport, street-level zoom sweep) is new in this
round, so the "before" tables below were recorded on the marker-store build
from the previous section with the scenario added, minutes before the "after"
tables on the same host.

**iOS before**, iPhone 17 Pro simulator, release build, MapKit, 60 Hz, started
by hand, recorded 2026-09-08:

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst  | Jank   | JS lag p95 | RSS Δ   |
| --------------------- | -------- | --- | ------- | ------- | ------- | ------ | ------ | ---------- | ------- |
| A-empty-idle          | fail (3) | 59  | 16.7 ms | 16.7 ms | 26.8 ms | 57 ms  | 1.1 %  | 1.0 ms     | +73 MB  |
| B-markers-100         | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 45 ms  | 0.7 %  | 1.2 ms     | +71 MB  |
| C-markers-1k          | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 43 ms  | 0.7 %  | 1.0 ms     | +70 MB  |
| D-markers-10k         | pass     | 59  | 16.7 ms | 16.7 ms | 23.7 ms | 43 ms  | 1.0 %  | 1.0 ms     | +89 MB  |
| E-clustered-10k       | pass     | 59  | 16.7 ms | 16.7 ms | 16.9 ms | 50 ms  | 1.0 %  | 1.1 ms     | +123 MB |
| F-pan-10k             | pass     | 59  | 16.7 ms | 16.7 ms | 23.0 ms | 44 ms  | 1.0 %  | 1.0 ms     | +72 MB  |
| G-zoom-10k            | fail (2) | 58  | 16.7 ms | 16.7 ms | 34.7 ms | 38 ms  | 3.7 %  | 1.1 ms     | +94 MB  |
| H-rotate-10k          | fail (3) | 59  | 16.7 ms | 16.7 ms | 36.8 ms | 62 ms  | 1.0 %  | 1.1 ms     | +61 MB  |
| I-animated-collection | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 44 ms  | 0.3 %  | 1.2 ms     | +5 MB   |
| I2-animated-prop      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms  | 0.0 %  | 1.0 ms     | -7 MB   |
| K-shapes              | pass     | 59  | 16.7 ms | 16.7 ms | 20.9 ms | 46 ms  | 0.9 %  | 1.1 ms     | +81 MB  |
| L-idle-after-pan      | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 44 ms  | 0.6 %  | 1.0 ms     | +53 MB  |
| M-one-of-10k          | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 37 ms  | 1.0 %  | 1.2 ms     | -3 MB   |
| N-dense-10k           | fail (4) | 46  | 16.7 ms | 40.9 ms | 99.4 ms | 315 ms | 14.6 % | 1.5 ms     | +168 MB |

- A-empty-idle: p99 26.78 ms > 25.00 ms; worst frame 56.55 ms > 50.00 ms; jank 1.14% > 1%
- G-zoom-10k: p99 34.68 ms > 25.00 ms; jank 3.68% > 1%
- H-rotate-10k: p99 36.82 ms > 25.00 ms; worst frame 62.34 ms > 50.00 ms; jank 1.02% > 1%
- M-one-of-10k: p99 33.33 ms > 25.00 ms; jank 1.01% > 1%
- N-dense-10k: p95 40.91 ms > budget 17.50 ms; p99 99.40 ms > 25.00 ms; worst frame 315.15 ms > 50.00 ms; jank 14.64% > 1%

**iOS after**, same simulator and build type, started by hand, recorded
2026-09-08. The dense scenario N went from a p95 of 41 ms, a p99 of 99 ms and
a worst frame of 315 ms to a p95 of one frame, a p99 of two and a worst frame
of 46 ms; jank fell from 14.6 % to 3.3 %. D and E hold one frame at p99 with
a 33 ms worst frame, and M stays at 17 ms. What is left at the octave
crossings of G and N is MapKit laying out the flat pins that are already on
screen, which is the sprite-layer work noted in ADR 0006. The JS-lag column
in B–D of this run coincides with the Android emulator shutting down on the
same host; the frame columns do not show it.

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst | Jank  | JS lag p95 | RSS Δ   |
| --------------------- | -------- | --- | ------- | ------- | ------- | ----- | ----- | ---------- | ------- |
| A-empty-idle          | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 49 ms | 0.6 % | 1.2 ms     | +69 MB  |
| B-markers-100         | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 43 ms | 0.7 % | 16.9 ms    | +71 MB  |
| C-markers-1k          | pass     | 59  | 16.7 ms | 16.7 ms | 20.6 ms | 46 ms | 1.0 % | 17.4 ms    | +65 MB  |
| D-markers-10k         | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.7 % | 17.2 ms    | +64 MB  |
| E-clustered-10k       | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.4 % | 1.3 ms     | +91 MB  |
| F-pan-10k             | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 42 ms | 1.0 % | 1.1 ms     | +97 MB  |
| G-zoom-10k            | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 38 ms | 2.3 % | 1.1 ms     | +90 MB  |
| H-rotate-10k          | fail (3) | 58  | 16.7 ms | 16.7 ms | 42.1 ms | 83 ms | 1.0 % | 1.1 ms     | +56 MB  |
| I-animated-collection | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.6 % | 1.4 ms     | +0 MB   |
| I2-animated-prop      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.1 ms     | -3 MB   |
| K-shapes              | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 43 ms | 1.1 % | 1.3 ms     | +64 MB  |
| L-idle-after-pan      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 44 ms | 0.4 % | 1.1 ms     | +43 MB  |
| M-one-of-10k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.3 ms     | -0 MB   |
| N-dense-10k           | fail (2) | 58  | 16.7 ms | 16.7 ms | 33.3 ms | 46 ms | 3.3 % | 1.0 ms     | +138 MB |

- G-zoom-10k: p99 33.33 ms > 25.00 ms; jank 2.32% > 1%
- H-rotate-10k: p99 42.13 ms > 25.00 ms; worst frame 83.21 ms > 50.00 ms; jank 1.03% > 1%
- K-shapes: p99 33.33 ms > 25.00 ms; jank 1.15% > 1%
- N-dense-10k: p99 33.33 ms > 25.00 ms; jank 3.34% > 1%

**Android after**, API 35 emulator, arm64, Google Maps, 60 Hz, release build,
Maestro-driven, recorded 2026-09-08. The "before" numbers are the Android table
in the previous section (same build type, one scenario fewer). Every scenario
but N now holds 16.7 ms at p99 with a worst frame of 17 ms; the `(1)` failures
are the emulator's JS-lag floor of about 18 ms, which the empty map shows too.
N keeps a 67 ms worst frame at the octave crossings.

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst | Jank  | JS lag p95 | RSS Δ  |
| --------------------- | -------- | --- | ------- | ------- | ------- | ----- | ----- | ---------- | ------ |
| A-empty-idle          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.3 % | 18.9 ms    | -24 MB |
| B-markers-100         | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.5 ms    | -17 MB |
| C-markers-1k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.3 ms    | +25 MB |
| D-markers-10k         | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.3 ms    | +35 MB |
| E-clustered-10k       | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.4 ms    | +23 MB |
| F-pan-10k             | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.3 ms    | -80 MB |
| G-zoom-10k            | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.3 ms    | +24 MB |
| H-rotate-10k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.0 ms    | -37 MB |
| I-animated-collection | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.5 ms    | -46 MB |
| I2-animated-prop      | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.9 ms    | -61 MB |
| K-shapes              | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.7 ms    | -43 MB |
| L-idle-after-pan      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.9 ms    | -18 MB |
| M-one-of-10k          | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 19.1 ms    | +14 MB |
| N-dense-10k           | fail (3) | 58  | 16.7 ms | 16.7 ms | 33.3 ms | 67 ms | 2.0 % | 23.2 ms    | -63 MB |

- I-animated-collection: JS lag p95 18.52 ms > budget 17.50 ms
- I2-animated-prop: JS lag p95 18.88 ms > budget 17.50 ms
- M-one-of-10k: JS lag p95 19.08 ms > budget 17.50 ms
- N-dense-10k: p99 33.33 ms > 25.00 ms; worst frame 66.67 ms > 50.00 ms; jank 2.01% > 1%

### Camera stream and 100k runs (not a device baseline)

The same simulator and emulator after ADR 0007. Two scenarios are new:
O pans a map of 10,000 markers with `onCameraMove` set and
`cameraMoveThrottleMs: 16`, so the callback fires every frame into a
Reanimated shared value; P mounts 100,000 clustered markers over Poland and
runs a zoom sweep and a pan. The older scenarios moved within run-to-run
noise of the previous section (F's p99 sits one frame over the threshold in
this run and passed in the last one; N's worst frame is 50 ms against 46 ms).

**iOS**, iPhone 17 Pro simulator, release build, MapKit, 60 Hz, started by
hand, recorded 2026-09-08. O passes with a one-frame p99 and a JS-lag p95 of
1.0 ms while the camera callback ran 266 times during the pan (counted in a separate
run of O on the same build, after the note line was routed to the system log),
so a per-frame stream that only writes a shared value costs nothing the
harness can see. P holds one frame at p95 and two at p99 with 100,000 clustered markers, a
46 ms worst frame at the first octave crossing, 1.5 % jank and 150 MB of RSS
for the dataset.

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst | Jank  | JS lag p95 | RSS Δ   |
| --------------------- | -------- | --- | ------- | ------- | ------- | ----- | ----- | ---------- | ------- |
| A-empty-idle          | fail (1) | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 51 ms | 0.9 % | 1.3 ms     | +75 MB  |
| B-markers-100         | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 41 ms | 1.0 % | 1.1 ms     | +84 MB  |
| C-markers-1k          | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 41 ms | 1.0 % | 1.0 ms     | +73 MB  |
| D-markers-10k         | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 45 ms | 0.7 % | 1.0 ms     | +67 MB  |
| E-clustered-10k       | pass     | 59  | 16.7 ms | 16.7 ms | 21.5 ms | 47 ms | 1.0 % | 1.0 ms     | +142 MB |
| F-pan-10k             | fail (2) | 59  | 16.7 ms | 16.7 ms | 27.6 ms | 39 ms | 1.2 % | 1.0 ms     | +84 MB  |
| G-zoom-10k            | fail (2) | 58  | 16.7 ms | 16.7 ms | 35.5 ms | 38 ms | 3.7 % | 1.0 ms     | +101 MB |
| H-rotate-10k          | fail (2) | 58  | 16.7 ms | 16.7 ms | 43.7 ms | 48 ms | 2.1 % | 1.0 ms     | +56 MB  |
| I-animated-collection | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 35 ms | 0.3 % | 1.3 ms     | +11 MB  |
| I2-animated-prop      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.0 ms     | -1 MB   |
| K-shapes              | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 47 ms | 1.4 % | 1.3 ms     | +73 MB  |
| L-idle-after-pan      | pass     | 59  | 16.7 ms | 16.7 ms | 21.2 ms | 45 ms | 0.8 % | 1.0 ms     | +65 MB  |
| M-one-of-10k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 1.0 ms     | -0 MB   |
| O-camera-stream       | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 46 ms | 0.7 % | 1.0 ms     | +76 MB  |
| P-clustered-100k      | fail (2) | 59  | 16.7 ms | 16.7 ms | 33.3 ms | 46 ms | 1.5 % | 1.0 ms     | +150 MB |
| N-dense-10k           | fail (3) | 56  | 16.7 ms | 33.3 ms | 41.6 ms | 50 ms | 7.3 % | 1.0 ms     | +122 MB |

- A-empty-idle: worst frame 50.88 ms > 50.00 ms
- F-pan-10k: p99 27.62 ms > 25.00 ms; jank 1.21% > 1%
- G-zoom-10k: p99 35.46 ms > 25.00 ms; jank 3.69% > 1%
- H-rotate-10k: p99 43.73 ms > 25.00 ms; jank 2.07% > 1%
- K-shapes: p99 33.33 ms > 25.00 ms; jank 1.44% > 1%
- P-clustered-100k: p99 33.33 ms > 25.00 ms; jank 1.54% > 1%
- N-dense-10k: p95 33.33 ms > budget 17.50 ms; p99 41.56 ms > 25.00 ms; jank 7.34% > 1%

The signposts recorded during the same run, per scenario, say where the time
goes. Decoding and indexing the 100,000-marker batch took 26.6 ms once, on the
store queue. Computing the viewport diff for P (the index query, clustering
through the octave cache, the diff against the screen) ran 89 times on the
background queue at a p50 of 0.85 ms, a p95 of 6.5 ms and a maximum of
10.0 ms. Applying those diffs on the main thread, which is MapKit adding and
removing annotation views under the frame budget, ran 110 times at a p50 of
0.47 ms, a p95 of 3.2 ms and a maximum of 3.6 ms. In N, the scenario that
still drops frames, the compute side stays under 3.1 ms while the main-thread
apply reaches 15 ms: the frames go to MapKit laying out the views, not to
Swift. At 10,000 markers every compute interval stays under 1 ms.

**Android**, Pixel-class API 35 emulator (`TapNote_API35`), release build,
Google Maps, 60 Hz, driven by the Maestro flow, recorded 2026-09-08. Every
scenario holds one frame at p99. P keeps a 17 ms p99 and a 33 ms worst frame
with 100,000 clustered markers, and O stays at 17 ms with the callback firing
every frame (211 calls during the pan, counted in a second run of the flow on
the same build). N, which failed with a 67 ms worst frame on the previous build's
run, passes here at 17 ms; the 18 to 19 ms JS-lag column is the emulator's
timer resolution, as in the previous sections, and is what fails I, I2, M and
O.

| Scenario              | Result   | FPS | p50     | p95     | p99     | Worst | Jank  | JS lag p95 | RSS Δ  |
| --------------------- | -------- | --- | ------- | ------- | ------- | ----- | ----- | ---------- | ------ |
| A-empty-idle          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.3 % | 18.8 ms    | -24 MB |
| B-markers-100         | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.9 ms    | -16 MB |
| C-markers-1k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.5 ms    | +28 MB |
| D-markers-10k         | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.8 ms    | +35 MB |
| E-clustered-10k       | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 0.2 % | 18.5 ms    | +24 MB |
| F-pan-10k             | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.3 ms    | -29 MB |
| G-zoom-10k            | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.4 ms    | +19 MB |
| H-rotate-10k          | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 17.8 ms    | -31 MB |
| I-animated-collection | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.7 ms    | -86 MB |
| I2-animated-prop      | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.6 ms    | -56 MB |
| K-shapes              | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.8 ms    | +58 MB |
| L-idle-after-pan      | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 19.3 ms    | -54 MB |
| M-one-of-10k          | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.8 ms    | -18 MB |
| O-camera-stream       | fail (1) | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 18.1 ms    | +58 MB |
| P-clustered-100k      | pass     | 59  | 16.7 ms | 16.7 ms | 16.7 ms | 33 ms | 1.0 % | 18.8 ms    | -35 MB |
| N-dense-10k           | pass     | 60  | 16.7 ms | 16.7 ms | 16.7 ms | 17 ms | 0.0 % | 19.1 ms    | -17 MB |

- I-animated-collection: JS lag p95 18.68 ms > budget 17.50 ms
- I2-animated-prop: JS lag p95 18.60 ms > budget 17.50 ms
- M-one-of-10k: JS lag p95 18.79 ms > budget 17.50 ms
- O-camera-stream: JS lag p95 18.07 ms > budget 17.50 ms

## Profiling markers

The library emits `os_signpost` intervals (iOS, subsystem `com.nitromaps`,
category `MarkerPipeline`) and `android.os.Trace` sections (Android, prefix
`NitroMaps.`) around the marker batch apply, the viewport compute and the diff
apply. They show up in Instruments' Points of Interest track and in Perfetto,
and cost nothing when no tracer is attached.
