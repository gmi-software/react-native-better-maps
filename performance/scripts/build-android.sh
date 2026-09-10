#!/usr/bin/env bash
# Builds the performance-lab variant of the example app for Android.
#
#   bash performance/scripts/build-android.sh [release|debug] [probes 1|0] [abi]
#
# The lab is selected at bundle time with EXPO_PUBLIC_PERF_LAB=1, and the
# library's PerfProbe recording is compiled in with -PNitroMaps_perfProbes=true
# (a "profile" build: release optimizations plus timing spans). Set JAVA_HOME
# to a JDK 17 when the default JDK fails on the prefab step.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VARIANT="${1:-release}"
PROBES="${2:-1}"
ABI="${3:-arm64-v8a}"

export EXPO_PUBLIC_PERF_LAB=1
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -z "${JAVA_HOME:-}" ] && [ -d /opt/homebrew/opt/openjdk@17 ]; then
  export JAVA_HOME=/opt/homebrew/opt/openjdk@17
fi

# EXPO_PUBLIC_* values are inlined by Babel; a stale Metro cache would keep the demo bundle.
rm -rf "${TMPDIR:-/tmp}/metro-cache"

(cd "$ROOT/package" && bun run build:plugin && bun run nitrogen)
if [ ! -d "$ROOT/example/android" ]; then
  (cd "$ROOT/example" && bun run prebuild -p android --no-install)
fi

case "$VARIANT" in
  release) TASK=":app:assembleRelease" ;;
  debug) TASK=":app:assembleDebug" ;;
  *) echo "unknown variant $VARIANT" >&2; exit 1 ;;
esac
PROBES_FLAG=false
if [ "$PROBES" = "1" ]; then PROBES_FLAG=true; fi

(cd "$ROOT/example/android" && ./gradlew "$TASK" \
  -PreactNativeArchitectures="$ABI" \
  -PNitroMaps_perfProbes="$PROBES_FLAG" \
  --console=plain)

echo "APK: $ROOT/example/android/app/build/outputs/apk/$VARIANT/app-$VARIANT.apk"
