#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Marker drag UI tests require macOS, Xcode, and an iOS Simulator." >&2
  exit 2
fi

command -v bun >/dev/null || { echo "bun is required" >&2; exit 2; }
command -v pod >/dev/null || { echo "CocoaPods is required" >&2; exit 2; }
command -v xcodebuild >/dev/null || { echo "Xcode command line tools are required" >&2; exit 2; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

bun install
bun run --filter react-native-better-maps build:plugin
bun run nitrogen

(
  cd example
  bunx expo prebuild --platform ios --no-install
  cd ios
  pod install
)

ruby example/scripts/configure-marker-drag-ui-tests.rb example/ios/NitroMapsExample.xcodeproj

SIMULATOR_ID="$(xcrun simctl list devices available -j | ruby -rjson -e '
devices = JSON.parse(STDIN.read).fetch("devices").values.flatten
device = devices.find { |entry| entry["isAvailable"] && entry["name"].start_with?("iPhone") }
abort "No available iPhone simulator was found." unless device
puts device.fetch("udid")
')"

DESTINATION="platform=iOS Simulator,id=${SIMULATOR_ID}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-$ROOT/.tmp/marker-drag-ui-tests}"
RESULT_BUNDLE_PATH="${RESULT_BUNDLE_PATH:-$ROOT/.tmp/marker-drag-ui-tests.xcresult}"
rm -rf "$RESULT_BUNDLE_PATH"

set -o pipefail
if command -v xcbeautify >/dev/null; then
  NSUnbufferedIO=YES xcodebuild test \
    -workspace example/ios/NitroMapsExample.xcworkspace \
    -scheme NitroMapsExample \
    -configuration Release \
    -destination "$DESTINATION" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    -resultBundlePath "$RESULT_BUNDLE_PATH" \
    -parallel-testing-enabled NO \
    -only-testing:NitroMapsExampleUITests/MarkerDragUITests/testDraggingPinAndImageMarkersOnlyFiresDragEnd \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
    | xcbeautify --renderer github-actions
else
  xcodebuild test \
    -workspace example/ios/NitroMapsExample.xcworkspace \
    -scheme NitroMapsExample \
    -configuration Release \
    -destination "$DESTINATION" \
    -derivedDataPath "$DERIVED_DATA_PATH" \
    -resultBundlePath "$RESULT_BUNDLE_PATH" \
    -parallel-testing-enabled NO \
    -only-testing:NitroMapsExampleUITests/MarkerDragUITests/testDraggingPinAndImageMarkersOnlyFiresDragEnd \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=""
fi
