#!/bin/bash
set -euo pipefail

# Requires an already booted simulator; does not touch the library/example build.
bench_dir="$(cd "$(dirname "$0")" && pwd)"
bench_device="${1:-booted}"
bench_output="${2:-$bench_dir/results/latest.json}"
bench_build="$(mktemp -d /tmp/nitro-marker-snapshot.XXXXXX)"
bench_bundle="software.gmi.nitromaps.snapshotbench"
bench_app="$bench_build/SnapshotBench.app"
mkdir -p "$bench_app" "$(dirname "$bench_output")"
bench_sdk="$(xcrun --sdk iphonesimulator --show-sdk-path)"
bench_arch="$(uname -m)"
trap 'rm -rf "$bench_build"' EXIT

cat > "$bench_app/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>SnapshotBench</string>
<key>CFBundleIdentifier</key><string>software.gmi.nitromaps.snapshotbench</string>
<key>CFBundleName</key><string>SnapshotBench</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>MinimumOSVersion</key><string>16.0</string>
<key>UILaunchScreen</key><dict/>
<key>CADisableMinimumFrameDurationOnPhone</key><true/>
</dict></plist>
PLIST

xcrun --sdk iphonesimulator swiftc -O -parse-as-library \
  -sdk "$bench_sdk" -target "$bench_arch-apple-ios16.0-simulator" \
  -module-cache-path "$bench_build/ModuleCache" \
  "$bench_dir/SnapshotBench.swift" "$bench_dir/HostChecks.swift" \
  "$bench_dir/../../package/ios/NitroMapContainerView.swift" \
  "$bench_dir/../../package/ios/NitroMarkerContentView.swift" -o "$bench_app/SnapshotBench"
codesign --force --sign - "$bench_app"
xcrun simctl terminate "$bench_device" "$bench_bundle" >/dev/null 2>&1 || true
xcrun simctl install "$bench_device" "$bench_app"
bench_container="$(xcrun simctl get_app_container "$bench_device" "$bench_bundle" data)"
rm -f "$bench_container/Documents/results.json"
xcrun simctl launch "$bench_device" "$bench_bundle" "${3:-}"
for ((bench_attempt=0; bench_attempt<180; bench_attempt++)); do
  if [[ -f "$bench_container/Documents/results.json" ]]; then
    cp "$bench_container/Documents/results.json" "$bench_output"
    xcrun simctl terminate "$bench_device" "$bench_bundle"
    echo "Saved UIKit CPU microbenchmark: $bench_output"
    exit 0
  fi
  sleep 1
done
echo "Benchmark timed out without results" >&2
exit 1
