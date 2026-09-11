#!/bin/bash

set -e

cd "$(dirname "$0")/.."

KOTLIN_PATTERNS=(
  "package/android/src/main/java/**/*.kt"
  "package/android/src/test/java/**/*.kt"
)

if which ktlint >/dev/null; then
  ktlint --editorconfig=./config/.editorconfig --format "${KOTLIN_PATTERNS[@]}"
  echo "Kotlin Format done!"
else
  echo "error: ktlint not installed, install with 'brew install ktlint' (see https://github.com/pinterest/ktlint )"
  exit 1
fi
