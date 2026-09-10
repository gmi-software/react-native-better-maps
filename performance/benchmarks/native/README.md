# Native pipeline micro-benchmarks

The marker pipeline's pure functions (fingerprint, spatial index, viewport
filter, clustering, render diff) run without a map view, so they can be timed
in plain unit tests on a laptop. These numbers show algorithmic scaling
(1k → 100k), not device speed.

## Android (JVM, JUnit)

```bash
cd example/android
NITROMAPS_BENCH=1 ./gradlew :react-native-better-maps:testDebugUnitTest --tests '*PipelineBenchmarkTest*' -i 2>&1 | grep '\[bench\]'
```

Each line is one JSON record: `{"n":10000,"op":"clusters","medianMs":…}`.
Without `NITROMAPS_BENCH=1` the test class is skipped, so the normal test
run stays fast.

## iOS (XCTest)

The library's test spec is only built when the Podfile asks for it. Expo's
generated Podfile does not, so add this line to `example/ios/Podfile` inside
the target, run `pod install`, and the `react-native-better-maps-Unit-Tests`
scheme appears:

```ruby
pod 'react-native-better-maps', :path => '../../package', :testspecs => ['Tests']
```

Then:

```bash
cd example/ios && pod install
NITROMAPS_BENCH=1 xcodebuild test -workspace NitroMapsExample.xcworkspace \
  -scheme react-native-better-maps-Unit-Tests \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' 2>&1 | grep '\[bench\]'
```

`PipelineBenchmarkTests.swift` prints the same `[bench]` records. Both test
classes generate their own deterministic dataset (seeded, Warsaw-centred
Gaussian blobs); it is not byte-identical to the JS fixtures.
