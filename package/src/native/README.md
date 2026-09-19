# Native layer architecture

This directory contains the Nitro Module specifications and will host the JS ↔ native communication layer for `react-native-better-maps`.

## Directory structure

```
native/
├── specs/
│   └── MapView.nitro.ts    # HybridView spec (props + methods)
├── MapViewNative.ts        # getHostComponent bridge to the native view
└── README.md               # This file
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

Overlay components (`<Marker />`, `<Polyline />`, etc.) are lightweight React wrappers. `MapView` collects their props via `React.Children`, assigns public `id` values (explicit `id`, else `${type}-key-${key}`, else positional `${type}-${index}`), and serializes them into descriptor struct arrays passed to the native `HybridMapView`. Overlay interaction events flow back through id-keyed map-level callbacks; `MapView` dispatches them to the matching overlay's `onPress` / `onDragEnd` handlers.

```
<MapView>
  <Marker coordinate={...} />     → collected, serialized as MarkerDescriptor[]
  <Polyline coordinates={...} />  → collected, serialized as PolylineDescriptor[]
</MapView>
```

The public JSX API stays idiomatic React; native MapKit / Google Maps render overlays from the descriptor arrays.

## Regenerating native bindings

After changing `MapView.nitro.ts`, regenerate the native bindings:

1. Run `bun run nitrogen` from the repo root (outputs to `package/nitrogen/generated`).
2. Implement any new members in `ios/HybridMapView.swift` and
   `android/src/main/java/com/margelo/nitro/nitromaps/HybridMapView.kt`.
3. The React `MapView` component is bridged via `getHostComponent` in
   `src/native/MapViewNative.ts`; the Android view manager is registered in
   `NitroMapsPackage.kt` and the C++ library is loaded from `cpp-adapter.cpp`.

## Related files

- [`nitro.json`](../../nitro.json) — autolinking configuration
- [`ios/README.md`](../../ios/README.md) — iOS native implementation guide
- [`android/README.md`](../../android/README.md) — Android native implementation guide
- [`cpp/README.md`](../../cpp/README.md) — shared C++ code guide
