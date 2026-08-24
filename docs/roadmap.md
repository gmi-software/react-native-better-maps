# Roadmap

## Phase 1: Project skeleton

- [x] Monorepo structure with Bun workspaces
- [x] TypeScript types and interfaces
- [x] React component exports
- [x] Nitro config and initial HybridView spec
- [x] ESM build pipeline (react-native-builder-bob)
- [x] ESLint, Prettier, GitHub Actions CI
- [x] Expo example app
- [x] Documentation (README, architecture, contributing)

## Phase 2: Nitro View foundation

- [x] Finalize `MapView.nitro.ts` HybridView spec
- [x] Run Nitrogen codegen
- [x] Implement `HybridMapView` in Swift (iOS)
- [x] Implement `HybridMapView` in Kotlin (Android)
- [x] Wire React `MapView` to Nitro HybridView via `getHostComponent`
- [x] Verify native view renders in example app (`bun example ios` / `bun example android`)

## Phase 3: iOS — MapKit integration

- [x] Add MapKit framework dependency
- [x] Render MKMapView in HybridMapView
- [x] Support `mapType` (standard, satellite, hybrid; `terrain` falls back to standard on iOS)
- [x] Camera control (setCamera, animateCamera)
- [x] Region change events
- [x] Press and long-press events

## Phase 4: Android — Google Maps integration

- [x] Add Google Maps SDK dependency
- [x] Render MapView in HybridMapView
- [x] Support `mapType` (standard, satellite, hybrid, terrain)
- [x] Camera control
- [x] Region change events
- [x] Press and long-press events

## Phase 5: Overlays

- [x] Decide overlay architecture (per-view vs data-driven)
- [x] Marker rendering with title/subtitle callouts
- [x] Draggable markers
- [x] Polyline rendering with styling
- [x] Polygon rendering with fill/stroke
- [x] Circle rendering with radius
- [x] Overlay press events

## Phase 6: Events and gestures

Delivered incrementally during Phases 3–5; polished for platform consistency in Phase 6.

- [x] `onRegionChange` / `onRegionChangeComplete`
- [x] `onPress` / `onLongPress` on map
- [x] `onPress` / `onDragEnd` on markers
- [x] `onPress` on polylines, polygons, circles
- [x] `onMapReady` callback

## Phase 7: Advanced features

- [x] Marker clustering
- [x] Custom map styles
- [x] User location display
- [x] Compass and scale controls
- [x] Edge padding for camera fitting

## Phase 8: Polish and release

- [x] Multi-provider `MapView` architecture
- [x] Google Maps provider on iOS
- [x] Public README and package metadata
- [x] Expo setup documentation
- [x] CI quality checks
- [ ] Release performance benchmark pass
- [ ] Migration guide from react-native-maps
- [ ] npm publish (v1.0.0)
- [ ] GitHub release with changelog

## Open decisions

| Decision              | Options                                    | Status                                             |
| --------------------- | ------------------------------------------ | -------------------------------------------------- |
| Overlay architecture  | Per-view native vs data-driven descriptors | Data-driven (Option B)                             |
| Clustering library    | Custom vs platform-native                  | Platform-native (MKClusterAnnotation / maps-utils) |
| Provider architecture | In-place SDK switching vs adapter remount  | Provider adapter + React remount                   |
| Overlay animations    | Reanimated core path vs native descriptors | Native descriptor animations; Reanimated optional  |
| Custom view markers   | Snapshot-only vs live/hybrid native views  | Hybrid: live MapKit, snapshot Google (ADR 0004)    |
| Offline support       | Tile caching strategy                      | Future consideration                               |

## Custom view markers (ADR 0004)

- [x] Phase 0: apply `MarkerDescriptor` image, anchor, centerOffset, rotation, flat, and opacity on iOS Google
- [ ] Phase 1: `<Marker>` children via snapshot into existing image pipeline
- [ ] Phase 2: `<MarkerView>` HybridView — live MapKit views, snapshot on Google

## Future provider work

- [ ] OpenStreetMap-backed provider
- [ ] Mapbox provider
- [ ] Provider-specific install and configuration docs
