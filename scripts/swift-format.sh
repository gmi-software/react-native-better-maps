#!/bin/bash

set -e

cd "$(dirname "$0")/.."

SWIFT_DIRS=(
  "package/ios"
  "package/iosTests"
)

if which swift >/dev/null; then
  DIRS=$(printf "%s " "${SWIFT_DIRS[@]}")
  find $DIRS -type f \( -name "*.swift" \) -print0 | while read -r -d '' file; do
    swift format --configuration ./config/.swift-format --in-place "$file"
  done
  echo "Swift Format done!"
else
  echo "error: swift not installed, install the toolchain with Xcode."
  exit 1
fi
