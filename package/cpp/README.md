# C++ shared code

Code shared by the iOS and Android builds.

- `MarkerProjectionRegistry` — the screen translation of every live `MarkerView` host, written by the native host as the camera moves and read by the patched `HybridMarkerViewShadowNode` (see `scripts/patch-nitrogen-generated.mjs`) so Fabric measures a marker where it is drawn.

See [src/native/README.md](../src/native/README.md) for the JS ↔ native architecture.
