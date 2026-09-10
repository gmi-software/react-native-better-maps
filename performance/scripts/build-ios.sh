#!/usr/bin/env bash
# Builds the performance-lab variant of the example app for the iOS simulator.
#
#   bash performance/scripts/build-ios.sh [release|debug] [probes 1|0]
#
# For a physical iPhone open example/ios/NitroMapsExample.xcworkspace in Xcode
# with EXPO_PUBLIC_PERF_LAB=1 exported in the environment Xcode was launched
# from, select the Release scheme configuration and run on the device.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VARIANT="${1:-release}"
PROBES="${2:-1}"

export EXPO_PUBLIC_PERF_LAB=1
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export RUBYOPT="${RUBYOPT:--E utf-8}"

rm -rf "${TMPDIR:-/tmp}/metro-cache"

(cd "$ROOT/package" && bun run build:plugin && bun run nitrogen)
if [ ! -d "$ROOT/example/ios" ]; then
  (cd "$ROOT/example" && bun run prebuild -p ios --no-install)
fi

PROPS="$ROOT/example/ios/Podfile.properties.json"
node -e '
const fs = require("fs");
const file = process.argv[1];
const enabled = process.argv[2] === "1";
const props = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
if (enabled) props["betterMaps.perfProbes"] = "true"; else delete props["betterMaps.perfProbes"];
fs.writeFileSync(file, JSON.stringify(props, null, 2) + "\n");
' "$PROPS" "$PROBES"

(cd "$ROOT/example/ios" && pod install)

case "$VARIANT" in
  release) CONFIG=Release ;;
  debug) CONFIG=Debug ;;
  *) echo "unknown variant $VARIANT" >&2; exit 1 ;;
esac

xcodebuild \
  -workspace "$ROOT/example/ios/NitroMapsExample.xcworkspace" \
  -scheme NitroMapsExample \
  -configuration "$CONFIG" \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$ROOT/example/ios/build/perf-lab" \
  build | grep -E 'error:|warning: .*PerfLab|BUILD (SUCCEEDED|FAILED)' || true

echo "APP: $ROOT/example/ios/build/perf-lab/Build/Products/$CONFIG-iphonesimulator/NitroMapsExample.app"
