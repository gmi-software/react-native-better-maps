# iOS marker-drag UI regression

This UI test launches the Expo example on an iOS simulator and performs long-press drags on both a MapKit pin annotation and a bundled-image annotation. It verifies that each native drag-end callback is delivered and that the map-level long-press callback count stays at zero.

Run it on macOS with Xcode and CocoaPods installed:

```bash
bash example/scripts/run-marker-drag-ui-tests.sh
```

The script runs Expo prebuild, installs pods, adds a generated UI-test target to the ignored Xcode project, and executes the test. The target is generated instead of committed because `example/ios/` is intentionally ignored and recreated by Expo prebuild.

The same UI test runs on the Apple-provider leg of the native GitHub Actions workflow.
