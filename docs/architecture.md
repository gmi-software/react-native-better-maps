# Architecture

## Overview

`react-native-better-maps` is a React Native maps library built on [Nitro Modules](https://nitro.margelo.com) and the New Architecture. It provides a familiar component-based API while leveraging JSI for high-performance native communication.

## Layer diagram

```
┌─────────────────────────────────────────────────┐
│  Public API (TypeScript / React)                │
│  MapView, Marker, Polyline, Polygon, Circle,    │
│  Geojson                                        │
│  Types: Coordinate, Region, Camera, MapViewRef  │
├─────────────────────────────────────────────────┤
│  Nitro Layer                                    │
│  MapView.nitro.ts (HybridView spec)             │
│  nitro.json (autolinking)                       │
│  nitrogen/generated/ (codegen output)             │
├─────────────────────────────────────────────────┤
│  Native Implementation                          │
│  HybridMapView host → provider adapter          │
│  iOS: AppleMapProviderAdapter → MapKit          │
│       GoogleMapProviderAdapter → Google SDK     │
│  Android: GoogleMapProviderAdapter → Google SDK  │
│  C++: shared geometry / tile logic (optional)   │
└─────────────────────────────────────────────────┘
```

## Monorepo structure

```
react-native-better-maps/
├── package/          # Library package (react-native-better-maps)
│   ├── src/          # TypeScript source
│   ├── ios/          # Swift native code
│   ├── android/      # Kotlin native code
│   ├── cpp/          # Shared C++ code
│   └── nitro.json    # Nitrogen autolinking config
├── example/          # Expo example app
├── docs/             # Documentation
└── .github/          # CI workflows
```

## Component model

### MapView

The root component, backed by a Nitro `HybridMapView` host. The host owns a stable container view and delegates map behavior to a provider adapter selected before the native SDK map view is created.

Provider defaults are resolved in the React wrapper:

| Platform | Default provider | Current adapter                                      |
| -------- | ---------------- | ---------------------------------------------------- |
| iOS      | `apple`          | `AppleMapProviderAdapter` backed by MapKit           |
| Android  | `google`         | `GoogleMapProviderAdapter` backed by Google Maps SDK |

The iOS host also supports the explicit `google` provider through `GoogleMapProviderAdapter`. Unsupported explicit providers fail early in JS. Native hosts also reject unsupported providers if one reaches native code unexpectedly. Changing `provider` or `googleMapId` remounts the native view instead of recreating SDK views in place.

### Provider adapters

Provider adapters own SDK-specific view creation, destruction, lifecycle, camera operations, visible-region calculations, map type, gestures, controls, user location, overlays, press events, clustering, and custom styles. `HybridMapView` stores Nitro props and callbacks, installs the selected adapter, and replays the current state into that adapter. It builds the adapter once per prop transaction, in `afterUpdate()`: `provider` and `googleMapId` both configure the SDK map at creation, and Nitro applies them one setter at a time. A replaced adapter is destroyed before the next one is built.

### Events

Map and overlay callbacks are wired through Nitro listeners on the HybridView. Callbacks receive payloads directly (e.g. `onPress(coordinate)`, `onRegionChange(region)`).

| Callback                                    | Payload                  | Notes                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onRegionChange` / `onRegionChangeComplete` | `Region`                 | iOS uses `MKCoordinateRegion` (center + span); Android derives center + deltas from visible `LatLngBounds`. Values agree without rotation/pitch but may diverge when the map is tilted or rotated. |
| `onPress` / `onLongPress`                   | `Coordinate`             | Map background only; marker taps do not also fire map `onPress`.                                                                                                                                   |
| `onPoiPress`                                | `PoiPressEvent`          | Provider-owned base-map POIs only. Apple Maps emits category data; Google Maps emits place ID. POI taps do not also fire map `onPress`.                                                            |
| `onMapReady`                                | none                     | Fires once after the map finishes loading tiles.                                                                                                                                                   |
| `Marker.onPress` / `onDragEnd`              | none / `Coordinate`      | Dispatched by overlay `id` from native to JS registry.                                                                                                                                             |
| Overlay `onPress`                           | none                     | Polyline/polygon/circle children with `onPress` are sent as `tappable`; any other shape, bulk descriptors included, is untappable on every provider unless `tappable: true` is set.                |
| `onClusterPress`                            | `string[]`, `Coordinate` | Fires when a marker cluster is tapped; IDs are member marker overlay ids.                                                                                                                          |

### Advanced MapView props

| Prop / method | Notes |
| --- | --- |
| `provider` | Optional map rendering backend. Defaults to `apple` on iOS and `google` on Android. Explicit unsupported providers throw. |
| `googleMapId` | Google Cloud Map ID for the `google` provider. It is creation-time SDK configuration, so changing it remounts the native map view. |
| `clusteringEnabled` | Custom grid-based clustering via `MarkerClusterEngine` on both platforms (viewport-aware, background compute). |
| `Marker.clusterable` | Opt-out per marker (defaults to `true`). Non-clusterable markers always render individually. |
| `markerEnteringAnimation` / `Marker.enteringAnimation` | Native entering animation for newly added marker render elements. Per-marker values override the map-level default; `false` is an explicit opt-out. |
| `clusterEnteringAnimation` | Native entering animation for newly added marker-cluster render elements. Available only on providers with clustering support. |
| `customMapStyle` | JSON string. The `google` provider uses Google Maps JSON styles on iOS and Android. The `apple` provider maps a curated subset to `MKMapConfiguration` on iOS 16+. |
| `onPoiPress` | Reports provider-owned points of interest, not app-owned `Marker` overlays. It is enabled automatically when the callback is present. |
| `showsUserLocation` / `followsUserLocation` | Toggles the native user-location layer. Host app must request location permission (`NSLocationWhenInUseUsageDescription` on iOS; `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION` on Android). On Android the layer reads the fused location provider (`play-services-location`) and picks up a permission granted while the map is mounted, at the accuracy that permission allows. |
| `showsCompass` / `showsScale` | Compass on both platforms. Scale is iOS-only: Android ignores `showsScale`, and debug builds log a warning. |
| `mapPadding` | Edge insets in density-independent pixels. Applied via `layoutMargins` (`apple`), `GMSMapView.padding` (`google` on iOS) or `setPadding` (Android). The `region` prop is fitted inside the padded area, and `fitToCoordinates` padding is added on top of it. |
| `fitToCoordinates(coords, padding?, animated?)` | Imperative ref method; fits camera to a set of coordinates with optional padding. |
| `animateToRegion(region, duration?)` | Imperative ref method; frames a `Region` as the `region` prop does, over `duration` milliseconds. Apple MapKit turns the region into the camera `setRegion` would pick, on an off-screen `MKMapView`, and animates that camera: `setRegion` takes no duration and jumps rather than animates when the target is far away. |
| `pointForCoordinate(coord)` / `coordinateForPoint(point)` | Imperative ref methods; convert between a coordinate and a `Point` in density-independent pixels from the map view's top-left corner. iOS converts in the map view's own points; Android scales the device pixels of the Google Maps `Projection` by the screen density. |

### Imperative ref readiness

`MapViewRef` hands out a working handle during the commit that mounts the view,
which is earlier than the native map can exist. Buffers close that gap, and
none of them uses a timer:

- **JS** — Nitro delivers the `hybridRef` view prop one JS -> UI -> JS round trip
  after the mount transaction, so `MapViewCommands` (`package/src/native/mapViewCommands.ts`)
  holds every call made before it arrives and replays them in call order. Calls
  left waiting when the view unmounts are rejected, and later calls reject
  without reaching native. `setCamera`/`animateCamera` check the camera, and
  `animateToRegion` the region, before it is queued, so an invalid one rejects
  at once instead of waiting here.
- **Android** — `MapView.getMapAsync` answers later still, so
  `DeferredGoogleMap` holds camera work until the `GoogleMap` exists, and
  `configureMap` drains it after replaying the `region`/`camera` props. Without
  it the adapter would accept a camera call and quietly do nothing.
  `fitToCoordinates` and `animateToRegion` then wait once more, in
  `DeferredLayout`, for the map view's first layout pass, because
  `newLatLngBounds` throws on a view without a size. `pointForCoordinate` and
  `coordinateForPoint` wait for the same pass: the `region` prop is applied in
  it, so a projection taken earlier would describe a camera the map never
  shows. Each rejects if the view is released before that pass comes.
- **iOS** — `MKMapView`/`GMSMapView` exist as soon as the adapter is
  installed, so nothing waits for the map itself. The Google Maps SDK does
  apply the `region` fit and the safe-area padding a few hundred milliseconds
  after mount, though, so on that provider `pointForCoordinate` and
  `coordinateForPoint` wait for the map's first idle. MapKit applies both at
  once and converts straight away. On that provider `animateToRegion` waits
  instead for the map view's first size, which the camera framing a region
  depends on, and rejects if the view is released before it has one.

`onMapReady` is a separate, later signal - the map finished loading tiles - and
is not a precondition for using the ref.

### Platform gaps (Phase 8)

- **Provider availability** — `apple` and `google` are implemented on iOS, and `google` is implemented on Android. `openstreetmap` and `mapbox` are planned provider adapters.
- **Custom styles on Apple MapKit** — no full Google Maps JSON parity; only a curated subset is mapped to MapKit configuration.
- **Scale control on Google Maps** — Google Maps SDK has no native scale bar; `showsScale` is rejected for the `google` provider. With the provider omitted it still type-checks, so Android ignores it and logs a warning in debug builds.
- **User location** — the library toggles the layer only; permission prompts and manifest/Info.plist entries are the host app's responsibility.
- **`followsUserLocation` on Android** — ignored, because Google Maps has no follow mode; debug builds log a warning. `showsUserLocation` still shows the location layer. To follow the user, call `animateCamera` from a location listener in the host app.

### Overlay components

`Marker`, `Polyline`, `Polygon`, `Circle`, and `Geojson` are overlay components that compose inside `MapView`. Overlay props are collected on the JS side and serialized into descriptor structs passed to the native `HybridMapView` (data-driven architecture). `Geojson` is converted into marker, polyline, and polygon descriptors before that native pass; invalid GeoJSON is skipped with a development warning.

Each descriptor's `id` is the child's `id` prop, else its React `key`, else its position among the overlays of its kind that have neither (`marker-0`, …). Native adapters diff overlays by that id and report it back through the `MapView`-level press callbacks, so a key keeps an overlay's identity when a sibling before it is added or removed. `id` props are reserved first, and a key or position that collides with another overlay's id gets a `#2`, `#3`, … suffix with a development warning.

Marker and marker-cluster entering animations follow the same descriptor model. The public API accepts `false`, `system`, or a serializable preset config; the React wrapper normalizes that into native descriptors. Native provider adapters execute the animation when a marker render element appears in the render diff. Updating animation config for an already retained marker does not restart the animation; the new config is used the next time that marker is added again.

Google Maps SDKs are sensitive to marker animation churn. Large viewport refreshes can add many native marker instances on the main thread, so the Google provider limits how many markers animate per refresh and reveals the rest immediately. This keeps gestures responsive, but very large marker sets may still need clustering, disabled entering animations, or a future provider-specific animation strategy.

## Data flow (target state)

```
User interaction
    ↓
React component tree (<MapView><Marker /><Geojson /></MapView>)
    ↓
MapView collects overlay descriptors + props
    ↓
Nitro HybridView (JSI, zero-copy structs)
    ↓
Native HybridMapView (Swift / Kotlin)
    ↓
Platform map SDK renders
    ↓
Events flow back via Nitro listeners
    ↓
React callbacks (onPress, onRegionChange, etc.)
```

## Build pipeline

- **Source**: TypeScript in `package/src/`
- **Build**: `react-native-builder-bob` (ESM-only, `module` + `typescript` targets)
- **Metro**: Resolves the `react-native` export condition to `src/` (Nitro HybridView pattern)
- **Codegen**: Nitrogen reads `*.nitro.ts` specs and generates native bindings

## Technology choices

| Decision           | Choice                   | Rationale                              |
| ------------------ | ------------------------ | -------------------------------------- |
| Native bridge      | Nitro Modules            | JSI-based, type-safe, codegen          |
| Architecture       | New Architecture only    | Required by Nitro Views                |
| Build tool         | react-native-builder-bob | RN community standard                  |
| Package manager    | Bun workspaces           | Fast, modern                           |
| Module format      | ESM-only                 | Avoids dual-package hazard             |
| Example app        | Expo SDK 57              | New Arch mandatory, good DX            |
| iOS default maps   | MapKit                   | Native, no API key needed              |
| Google maps        | Google Maps SDK          | Shared provider on iOS and Android     |
| Provider switching | React remount            | Keeps native SDK lifecycle predictable |
