# Native layer architecture

This directory contains the Nitro Module specifications and will host the JS ↔ native communication layer for `react-native-better-maps`.

## Directory structure

```
native/
├── specs/
│   ├── MapView.nitro.ts            # HybridView spec (props + methods)
│   └── MarkerCollection.nitro.ts   # HybridObject spec (native marker store)
├── MapViewNative.ts                # getHostComponent bridge to the native view
└── README.md                       # This file
```

## JS ↔ native flow

```
React component (MapView.tsx)
    ↓
Nitro HybridView spec (MapView.nitro.ts)
    ↓
nitro.json autolinking
    ↓
Nitrogen codegen → nitrogen/generated/
    ↓
Native implementation (HybridMapView.swift / HybridMapView.kt)
    ↓
Platform map SDK (MapKit / Google Maps)
```

## Overlay architecture

**Decision: data-driven descriptors (Option B).**

Overlay components (`<Marker />`, `<Polyline />`, etc.) are lightweight React wrappers. `MapView` collects their props via `React.Children` and assigns stable `id` values. Polylines, polygons and circles are serialized into descriptor struct arrays passed as props to the native `HybridMapView`. Overlay interaction events flow back through id-keyed map-level callbacks; `MapView` dispatches them to the matching overlay's `onPress` / `onDragEnd` handlers.

Markers do not travel as a prop. `MapView` compiles them into delta batches for a `MarkerCollection` HybridObject (`src/markers/`), which owns the dataset natively; the `markerCollection` prop hands the native view that object. The batch layout is documented in `src/markers/markerBatch.ts` and decoded by `ios/MarkerBatchDecoder.swift` and `android/.../MarkerBatchDecoder.kt`.

```
<MapView>
  <Marker coordinate={...} />     → collected, diffed by id, sent as a packed batch to MarkerCollection
  <Polyline coordinates={...} />  → collected, serialized as PolylineDescriptor[]
</MapView>
```

The public JSX API stays idiomatic React; native MapKit / Google Maps render overlays from the store and the descriptor arrays.

## Regenerating native bindings

After changing a spec in `specs/`, regenerate the native bindings:

1. Run `bun run nitrogen` from the repo root (outputs to `package/nitrogen/generated`).
2. Implement any new members in `ios/HybridMapView.swift` / `ios/HybridMarkerCollection.swift` and
   `android/src/main/java/com/margelo/nitro/nitromaps/HybridMapView.kt` / `HybridMarkerCollection.kt`.
   `MarkerDescriptor`, `MarkerImage`, `MarkerAnchor` and `MarkerPoint` are hand-written natively
   (`ios/MarkerDescriptor.swift`, `android/.../MarkerDescriptor.kt`) because no spec references
   them anymore; a spec that references them again would make nitrogen generate conflicting types.
3. The React `MapView` component is bridged via `getHostComponent` in
   `src/native/MapViewNative.ts`; the Android view manager is registered in
   `NitroMapsPackage.kt` and the C++ library is loaded from `cpp-adapter.cpp`.

## Related files

- [`nitro.json`](../../nitro.json) — autolinking configuration
- [`ios/README.md`](../../ios/README.md) — iOS native implementation guide
- [`android/README.md`](../../android/README.md) — Android native implementation guide
- [`cpp/README.md`](../../cpp/README.md) — shared C++ code guide
