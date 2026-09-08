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
│  MarkerCollection.nitro.ts (HybridObject spec)  │
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

Provider adapters own SDK-specific view creation, destruction, lifecycle, camera operations, visible-region calculations, map type, gestures, controls, user location, overlays, press events, clustering, and custom styles. `HybridMapView` stores Nitro props and callbacks, installs the selected adapter, and replays the current state into that adapter.

### Events

Map and overlay callbacks are wired through Nitro listeners on the HybridView. Callbacks receive payloads directly (e.g. `onPress(coordinate)`, `onRegionChange(region)`).

| Callback                                    | Payload                  | Notes                                                                                                                                                                                              |
| ------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onRegionChange` / `onRegionChangeComplete` | `Region`                 | iOS uses `MKCoordinateRegion` (center + span); Android derives center + deltas from visible `LatLngBounds`. Values agree without rotation/pitch but may diverge when the map is tilted or rotated. |
| `onCameraMove`                              | `Camera`                 | Opt-in stream while the camera moves, at most every `cameraMoveThrottleMs` (default 100) and once more when it stops. MapKit samples it on a display link; the Google SDKs report per frame and the adapter throttles. Nothing runs unless the callback is set. |
| `onPress` / `onLongPress`                   | `Coordinate`             | Map background only; marker taps do not also fire map `onPress`.                                                                                                                                   |
| `onPoiPress`                                | `PoiPressEvent`          | Provider-owned base-map POIs only. Apple Maps emits category data; Google Maps emits place ID. POI taps do not also fire map `onPress`.                                                            |
| `onMapReady`                                | none                     | Fires once after the map finishes loading tiles.                                                                                                                                                   |
| `Marker.onPress` / `onDragEnd`              | none / `Coordinate`      | Dispatched by overlay `id` from native to JS registry.                                                                                                                                             |
| Overlay `onPress`                           | none                     | Polyline/polygon/circle with `onPress` default to `tappable` on native.                                                                                                                            |
| `onClusterPress`                            | `ClusterPressEvent`      | Fires when a marker cluster is tapped with `{ clusterId, count, coordinate }`. Member ids are fetched on demand through `MapViewRef.getClusterMembers(clusterId)`.                                 |

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
| `showsUserLocation` / `followsUserLocation` | Toggles the native user-location layer. Host app must request location permission (`NSLocationWhenInUseUsageDescription` on iOS; `ACCESS_FINE_LOCATION` on Android). |
| `showsCompass` / `showsScale` | Compass on both platforms. Scale is iOS-only (`showsScale` is a no-op on Android). |
| `mapPadding` | Edge insets in density-independent pixels. Applied via `layoutMargins` (iOS) or `setPadding` (Android). |
| `fitToCoordinates(coords, padding?, animated?)` | Imperative ref method; fits camera to a set of coordinates with optional padding. |
| `markerCollection` | A `MarkerCollection` owned by the app. Replaces `markers` and `<Marker>` children; updated through `set`, `upsert`, `remove` and `updatePositions`. |
| `pinStyle` | Apple MapKit only. `flat` (default) draws image-less markers as one pre-rendered image on an `MKAnnotationView`; `system` uses `MKMarkerAnnotationView`. |
| `markerRendering` | Apple MapKit only. `views` (default) is one annotation view per displayed marker; `sprites` draws the displayed markers and cluster badges into map tiles through `MarkerSpriteRenderer`, an `MKOverlayRenderer`. Draggable markers and the marker whose callout is open stay views. |
| `getClusterMembers(clusterId)` | Imperative ref method; resolves the marker ids inside a displayed cluster. |

### Platform gaps (Phase 8)

- **Provider availability** — `apple` and `google` are implemented on iOS, and `google` is implemented on Android. `openstreetmap` and `mapbox` are planned provider adapters.
- **Custom styles on Apple MapKit** — no full Google Maps JSON parity; only a curated subset is mapped to MapKit configuration.
- **Scale control on Google Maps** — Google Maps SDK has no native scale bar; `showsScale` is rejected for the `google` provider.
- **User location** — the library toggles the layer only; permission prompts and manifest/Info.plist entries are the host app's responsibility.
- **`followsUserLocation` on Android** — enables the location layer when permitted; continuous camera follow is not built into Google Maps and may require host-app camera updates.

### Overlay components

`Marker`, `Polyline`, `Polygon`, `Circle`, and `Geojson` are overlay components that compose inside `MapView`. Overlay props are collected on the JS side and serialized into descriptor structs passed to the native `HybridMapView` (data-driven architecture). `Geojson` is converted into marker, polyline, and polygon descriptors before that native pass; invalid GeoJSON is skipped with a development warning.

Markers take a different route, because their datasets are large and change often. The dataset lives in a native `MarkerStore` behind the `MarkerCollection` HybridObject. JS assigns every marker an integer handle, keeps the last descriptor it sent per id, and compiles `set` / `upsert` / `remove` / `updatePositions` into packed batches (`src/markers/markerBatch.ts`: a fixed-size record per upsert, four bytes per removal, 24 bytes per position update, plus a string table). The `markers` prop and `<Marker>` children compile to the same batches through a collection `MapView` owns. Natively the store decodes batches on a background thread into flat coordinate arrays, flags, versions and one descriptor per handle, keeps a grid index over handles that is updated in place, and notifies every attached map view. The map's pipeline queries the index for the viewport, clusters or thins the candidate handles, materializes descriptors only for what will be displayed, and diffs by `(handle, id)` against what is on screen. See [ADR 0005](adr/0005-marker-collection-store.md).

The diff does not reach the map SDK in one pass. A per-map scheduler driven by `CADisplayLink` on iOS and `Choreographer` on Android applies removals at once, then a bounded number of adds per frame, nearest to the camera first, then retained updates within a 2 ms budget; the add count halves after a long frame and grows back on frames within budget. A newer diff replaces whatever is still pending, which is safe because diffs are computed against what is actually on the map. On MapKit the live refresh during gestures runs off the same display link instead of a wall-clock timer, and image-less markers are flat pre-rendered pins unless `pinStyle="system"` asks for `MKMarkerAnnotationView`. Clustering keeps the buckets of the cells that were fully inside the previous padded viewport for as long as the zoom octave and the dataset stay the same, so a pan only accumulates the cells that entered. See [ADR 0006](adr/0006-frame-budgeted-rendering.md).

The camera reaches JS through two events per gesture, `onRegionChange` when it begins and `onRegionChangeComplete` when it ends, which suits data loading. Overlays that must track the map while it moves opt into `onCameraMove`: MapKit samples `MKMapView.camera` on a display link that runs only between `regionWillChange` and `regionDidChange`, the Google SDKs report the camera every frame and the adapter throttles it to `cameraMoveThrottleMs`, and every adapter emits the final camera once the move ends. The `react-native-better-maps/reanimated` entry point turns that stream into a Reanimated shared value so overlays follow the camera on the UI thread without a React render per update. See [ADR 0007](adr/0007-camera-stream-and-cpp-core.md).

With `markerRendering="sprites"` the MapKit controller keeps the same pipeline and diffs but applies the sprite part of each diff at once: a dictionary of sprites (coordinate, bitmap, size, offset, rotation, opacity) becomes an immutable snapshot that a world-sized `MKOverlay`'s renderer draws per tile on MapKit's threads, above the labels. A viewport change is then one snapshot swap and a background re-render instead of annotation-view layout on the main thread. Taps are hit-tested against the snapshot; a marker with a title is promoted to a selected annotation view for its callout and demoted when the callout closes; draggable markers always take the view path through the frame scheduler. See [ADR 0008](adr/0008-mapkit-sprite-layer.md).

Marker and marker-cluster entering animations follow the same descriptor model. The public API accepts `false`, `system`, or a serializable preset config; the React wrapper normalizes that into native descriptors. Native provider adapters execute the animation when a marker render element appears in the render diff. Updating animation config for an already retained marker does not restart the animation; the new config is used the next time that marker is added again.

Google Maps SDKs are sensitive to marker animation churn. Large viewport refreshes can add many native marker instances on the main thread, so the Google provider limits how many markers animate per refresh and reveals the rest immediately. This keeps gestures responsive, but very large marker sets may still need clustering, disabled entering animations, or a future provider-specific animation strategy.

## Data flow (target state)

```
User interaction
    ↓
React component tree (<MapView><Marker /><Geojson /></MapView>, or markerCollection)
    ↓
MapView collects overlay descriptors + props
    ↓                                   ↓
Nitro HybridView props                  MarkerCollection.applyBatch(ArrayBuffer, strings)
(shapes, camera, callbacks)             one packed delta batch per change
    ↓                                   ↓
Native HybridMapView (Swift / Kotlin) ← MarkerStore (handles, flat arrays, grid index)
    ↓
Viewport pipeline: index query → cluster / LOD → diff by handle → SDK objects
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
