# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.0

### Behavior changes

Two changes alter runtime behavior without changing any type signatures, so your
code keeps compiling but may behave differently after upgrading.

**`onRegionChange` and `onRegionChangeComplete` now fire once per gesture**

In 1.0.0 these fired repeatedly while the map was moving, and also fired for
programmatic camera updates. Now:

- `onRegionChange` fires **once** when a user-initiated region change **begins**
- `onRegionChangeComplete` fires **once** when the user gesture **ends**
- Programmatic updates (`setCamera`, `animateCamera`, `fitToCoordinates`) no
  longer emit either callback

If you relied on a continuous stream of region updates — a live coordinate
readout, or a "search this area" button that re-renders while panning — move that
work to `onRegionChangeComplete`, which now marks the end of the gesture:

```tsx
// Before: fired continuously during the gesture
<MapView onRegionChange={(region) => setSearchArea(region)} />

// After: fires once when the user stops moving the map
<MapView onRegionChangeComplete={(region) => setSearchArea(region)} />
```

**`MapViewRef` camera methods now return `Promise<void>`**

`setCamera`, `animateCamera`, and `fitToCoordinates` previously returned `void`.
Existing call sites still compile, but linters configured with
`@typescript-eslint/no-floating-promises` will now flag them, and any custom
implementation or test mock of `MapViewRef` must be updated to match.

```tsx
// Await the call, or explicitly ignore the promise
await mapRef.current?.animateCamera(camera, 300);
```

### Features

- Add native POI press events with provider-specific payloads
  (`onPoiPress`, `PoiPressEvent`, `ApplePoiPressEvent`, `GooglePoiPressEvent`)
  ([#36](https://github.com/gmi-software/react-native-better-maps/pull/36))
- Add Expo SDK 57 support
  ([#49](https://github.com/gmi-software/react-native-better-maps/pull/49))
- Rework map region change handling and camera update logic; programmatic
  updates now skip no-op native calls
  ([#48](https://github.com/gmi-software/react-native-better-maps/pull/48))

### Bug Fixes

- **ios:** Remove `main.sync` from `HybridMapView` and make camera APIs async,
  fixing main-thread deadlocks
  ([#45](https://github.com/gmi-software/react-native-better-maps/pull/45))
- **ios:** Fix threading issues in map view ownership
  ([#43](https://github.com/gmi-software/react-native-better-maps/pull/43))
- **android:** Align SDK versions with the nitro-modules prefab
  ([#41](https://github.com/gmi-software/react-native-better-maps/pull/41))
- Fix failure on first-time build
  ([#39](https://github.com/gmi-software/react-native-better-maps/pull/39))

## 1.0.0

Initial public release: high-performance maps for React Native built on Nitro
Modules and the New Architecture, with Apple Maps and Google Maps providers on
iOS and Android.
