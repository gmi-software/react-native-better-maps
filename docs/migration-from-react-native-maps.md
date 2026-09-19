# Migration from react-native-maps

This guide is the living compatibility reference for moving a map from
[`react-native-maps`](https://github.com/react-native-maps/react-native-maps)
to [`react-native-better-maps`](https://github.com/gmi-software/react-native-better-maps).

It answers three questions:

1. Can we migrate?
2. What code and setup changes are required?
3. Which props and components are supported, renamed, partial, or missing?

> **Last reviewed against** `react-native-better-maps` **v1.2.1** on
> `main` (`2436539`, 2026-09-19) and the public
> [react-native-maps MapView](https://github.com/react-native-maps/react-native-maps/blob/master/docs/mapview.md)
> / [Marker](https://github.com/react-native-maps/react-native-maps/blob/master/docs/marker.md)
> docs. The published package name is `react-native-better-maps` — not the
> older `react-native-nitro-maps` name that appears in some issue text.

Prop lists in the **better-maps** columns come from the current public
TypeScript exports in `package/src/index.ts` (`MapViewProps`,
`MapViewPropsForProvider`, `MarkerProps`, `PolylineProps`, `PolygonProps`,
`CircleProps`, `GeojsonProps`, `MapViewRef`). Update this file when those
types change.

## Can we migrate?

**Yes for most map + overlay apps** if you can accept New Architecture only
and the gaps below.

Typical fit:

- Apple MapKit on iOS and/or Google Maps on Android (and Google Maps on iOS)
- Markers (default pins or bitmap images), polylines, polygons, circles
- GeoJSON FeatureCollections
- Built-in marker clustering
- Declarative `region` / `camera` plus imperative `animateCamera` /
  `fitToCoordinates`

Not a drop-in if you depend on any of:

- Custom React children inside `<Marker>` (live views) — [\#34](https://github.com/gmi-software/react-native-better-maps/issues/34)
- Custom `<Callout>` UI or `showCallout()` / `hideCallout()` — [\#15](https://github.com/gmi-software/react-native-better-maps/issues/15)
- Raster tiles (`UrlTile` / `WMSTile` / `LocalTile`) — [\#17](https://github.com/gmi-software/react-native-better-maps/issues/17)
- `react-native-maps-directions` / `MapViewDirections` — [\#6](https://github.com/gmi-software/react-native-better-maps/issues/6)–[\#10](https://github.com/gmi-software/react-native-better-maps/issues/10)
- Ground-image `Overlay` or `Heatmap` — not planned
- The legacy (non–New Architecture) React Native bridge

## Status legend

| Status           | Meaning                                                              |
| ---------------- | -------------------------------------------------------------------- |
| ✅ Supported     | Same or equivalent behavior on the current public API                |
| 🔄 Renamed       | Different name, type, or call shape — mapping is in the Notes column |
| ⚠️ Partial       | Works with a platform, provider, or semantics caveat                 |
| ❌ Not supported | No equivalent yet — links an open issue when one exists              |
| 🚫 Not planned   | Intentionally out of scope / no tracking issue                       |

## Installation and setup

### Package names and peers

|              | react-native-maps                                                                                                                              | react-native-better-maps                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| npm package  | `react-native-maps`                                                                                                                            | `react-native-better-maps`                                   |
| Import       | `import MapView, { Marker } from 'react-native-maps'`                                                                                          | `import { MapView, Marker } from 'react-native-better-maps'` |
| Architecture | Old + New Architecture                                                                                                                         | **New Architecture only** (Nitro HybridView + JSI)           |
| Peer         | none extra                                                                                                                                     | `react-native-nitro-modules >= 0.35.0`                       |
| React Native | various                                                                                                                                        | `>= 0.78`                                                    |
| Expo         | Expo Go / dev client (plugin often broken on SDK 56; see [rn-maps \#5927](https://github.com/react-native-maps/react-native-maps/issues/5927)) | SDK 56+ **development build** (Expo Go is not supported)     |

```bash
bun remove react-native-maps
bun add react-native-better-maps react-native-nitro-modules
```

`react-native-nitro-modules` is required. Rebuild native projects after the
swap — Nitro views are not available in Expo Go or in a JS-only refresh.

### Remove react-native-maps native config

After switching packages, delete leftover rn-maps wiring so the two libraries
do not both register map views:

- **Expo:** remove the `react-native-maps` config plugin from `app.json` /
  `app.config.js`. Add the `react-native-better-maps` plugin instead (see
  [Expo setup](expo-setup.md)).
- **iOS:** remove `react-native-maps` pods (`react-native-maps`,
  `react-native-google-maps` if present) and any
  `GMSServices.provideAPIKey(...)` that existed only for rn-maps. Run
  `pod install`.
- **Android:** remove rn-maps `AndroidManifest` / Gradle entries that are not
  still needed for Google Maps itself. Keep a Google Maps API key if you use
  the `google` provider.
- Uninstall `react-native-maps-directions` if you used it. There is no
  published replacement yet — see [Directions](#directions).

### Expo plugin

The Expo config plugin **ships today** ([\#12](https://github.com/gmi-software/react-native-better-maps/issues/12)
is closed). It injects Google Maps keys and location permission strings.

```js
// app.config.js
module.exports = {
  expo: {
    plugins: [
      [
        'react-native-better-maps',
        {
          googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
          locationPermission:
            'Allow $(PRODUCT_NAME) to use your location for map features.',
        },
      ],
    ],
  },
};
```

Then `expo prebuild --clean` and `expo run:ios` / `expo run:android`. Full
options are in [docs/expo-setup.md](expo-setup.md) and the README.

### API keys

| Provider         | iOS                                                                                                                                         | Android                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apple` (MapKit) | No key                                                                                                                                      | n/a (`apple` is iOS-only)                                           |
| `google`         | `GoogleMapsIosApiKey` in `Info.plist` **and** `"betterMaps.iosGoogleProvider": "true"` in `ios/Podfile.properties.json`, then `pod install` | `com.google.android.geo.API_KEY` meta-data in `AndroidManifest.xml` |

This is different from typical rn-maps iOS setup (`GMSServices.provideAPIKey`
/ `GMSApiKey`). The Expo plugin writes both iOS artifacts together. Bare
apps must set both manually — see [Google Maps setup](../README.md#google-maps-setup).

`googleMapId` is supported on the explicit `google` provider. Changing
`provider` or `googleMapId` remounts the native view.

## Compatibility matrix

### MapView props

Public `MapViewProps` / `MapViewPropsForProvider` fields first, then common
rn-maps props that have no export here.

| react-native-maps                                                                                                                                    | Status | react-native-better-maps                                         | Notes                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider` / `PROVIDER_GOOGLE`                                                                                                                       | 🔄     | `provider?: 'apple' \| 'google' \| 'openstreetmap' \| 'mapbox'`  | Use `'google'` instead of `PROVIDER_GOOGLE`. Omit for defaults (`apple` on iOS, `google` on Android). `openstreetmap` ([\#3](https://github.com/gmi-software/react-native-better-maps/issues/3)) and `mapbox` ([\#4](https://github.com/gmi-software/react-native-better-maps/issues/4)) are reserved names and throw if selected.  |
| `region`                                                                                                                                             | ⚠️     | `region?: Region`                                                | Same `{ latitude, longitude, latitudeDelta, longitudeDelta }` shape. Native skips applying it while the user is interacting (and when `camera` is also set). There is no separate uncontrolled prop.                                                                                                                                |
| `initialRegion`                                                                                                                                      | 🔄     | `region`                                                         | Pass a one-time `region`. Updates after the user pans are not applied while a gesture is in progress.                                                                                                                                                                                                                               |
| `camera`                                                                                                                                             | ✅     | `camera?: Camera`                                                | `{ center, zoom?, heading?, pitch?, altitude? }`. `altitude` is Apple MapKit only; Google Maps uses `zoom`.                                                                                                                                                                                                                         |
| `initialCamera`                                                                                                                                      | 🔄     | `camera`                                                         | Same as `initialRegion` — use `camera` once.                                                                                                                                                                                                                                                                                        |
| `mapType`                                                                                                                                            | ⚠️     | `mapType?: 'standard' \| 'satellite' \| 'hybrid' \| 'terrain'`   | `terrain` falls back to `standard` on Apple MapKit. rn-maps extras (`none`, `mutedStandard`, `satelliteFlyover`, `hybridFlyover`) are 🚫 not planned.                                                                                                                                                                               |
| `customMapStyle`                                                                                                                                     | 🔄     | `customMapStyle?: string`                                        | **JSON string**, not a style array. Full Google Maps JSON on `google`; curated MapKit subset on `apple` (iOS 16+).                                                                                                                                                                                                                  |
| `googleMapId`                                                                                                                                        | ✅     | `googleMapId?: string`                                           | `google` provider only. Changing it remounts the native view.                                                                                                                                                                                                                                                                       |
| `scrollEnabled`                                                                                                                                      | ✅     | `scrollEnabled?: boolean`                                        |                                                                                                                                                                                                                                                                                                                                     |
| `zoomEnabled`                                                                                                                                        | ✅     | `zoomEnabled?: boolean`                                          |                                                                                                                                                                                                                                                                                                                                     |
| `rotateEnabled`                                                                                                                                      | ✅     | `rotateEnabled?: boolean`                                        |                                                                                                                                                                                                                                                                                                                                     |
| `pitchEnabled`                                                                                                                                       | ✅     | `pitchEnabled?: boolean`                                         |                                                                                                                                                                                                                                                                                                                                     |
| `showsUserLocation`                                                                                                                                  | ⚠️     | `showsUserLocation?: boolean`                                    | Toggles the native layer only. The host app must request permission (`NSLocationWhenInUseUsageDescription` / `ACCESS_FINE_LOCATION`).                                                                                                                                                                                               |
| `followsUserLocation`                                                                                                                                | ⚠️     | `followsUserLocation?: boolean`                                  | Apple MapKit follows the user. On Android / Google, the location layer is enabled but continuous camera follow is not built in ([\#104](https://github.com/gmi-software/react-native-better-maps/issues/104), [\#112](https://github.com/gmi-software/react-native-better-maps/issues/112)).                                        |
| `showsCompass`                                                                                                                                       | ✅     | `showsCompass?: boolean`                                         |                                                                                                                                                                                                                                                                                                                                     |
| `showsScale`                                                                                                                                         | ⚠️     | `showsScale?: boolean`                                           | Apple MapKit only. Typed as `never` for `provider="google"`; a no-op / rejected on Google ([\#104](https://github.com/gmi-software/react-native-better-maps/issues/104)).                                                                                                                                                           |
| `mapPadding`                                                                                                                                         | ✅     | `mapPadding?: EdgePadding`                                       | `{ top, right, bottom, left }` in dp. Android currently collapses the four values in `fitToCoordinates` ([\#103](https://github.com/gmi-software/react-native-better-maps/issues/103)).                                                                                                                                             |
| `style`                                                                                                                                              | ✅     | `style?: StyleProp<ViewStyle>`                                   |                                                                                                                                                                                                                                                                                                                                     |
| `children`                                                                                                                                           | ⚠️     | `children?: ReactNode`                                           | Overlay children only: `Marker`, `Polyline`, `Polygon`, `Circle`, `Geojson`. Do not wrap them in a custom component or Fragment unless that wrapper is unwrapped (see [\#134](https://github.com/gmi-software/react-native-better-maps/issues/134) / [\#140](https://github.com/gmi-software/react-native-better-maps/issues/140)). |
| `onMapReady`                                                                                                                                         | ✅     | `onMapReady?: () => void`                                        | Fires once after tiles load. No `nativeEvent` wrapper.                                                                                                                                                                                                                                                                              |
| `onPress`                                                                                                                                            | 🔄     | `onPress?: (coordinate: Coordinate) => void`                     | Payload is the coordinate, not `e.nativeEvent`. Marker / POI taps do not also fire map `onPress`.                                                                                                                                                                                                                                   |
| `onLongPress`                                                                                                                                        | 🔄     | `onLongPress?: (coordinate: Coordinate) => void`                 | Same payload change. Apple Maps can also fire this during a marker drag ([\#132](https://github.com/gmi-software/react-native-better-maps/issues/132)).                                                                                                                                                                             |
| `onPoiClick`                                                                                                                                         | 🔄     | `onPoiPress?: (event: PoiPressEvent) => void`                    | Enabled when the callback is set. Apple: `category` (no place id). Google: `placeId`.                                                                                                                                                                                                                                               |
| `onRegionChange`                                                                                                                                     | ⚠️     | `onRegionChange?: (region: Region) => void`                      | Fires **once** when a **user-initiated** change **begins**, not continuously. No `{ isGesture }` argument ([\#137](https://github.com/gmi-software/react-native-better-maps/issues/137)). Region values can diverge across providers when the map is tilted or rotated.                                                             |
| `onRegionChangeComplete`                                                                                                                             | ⚠️     | `onRegionChangeComplete?: (region: Region) => void`              | Fires **once** when a user-initiated change **ends**. Same caveats as `onRegionChange`.                                                                                                                                                                                                                                             |
| `onMarkerPress`                                                                                                                                      | 🔄     | `onMarkerPress?: (id: string) => void`                           | Receives the overlay `id`, not a press event.                                                                                                                                                                                                                                                                                       |
| `onMarkerDragEnd`                                                                                                                                    | 🔄     | `onMarkerDragEnd?: (id: string, coordinate: Coordinate) => void` | Map-level helper for bulk markers. Per-marker `Marker.onDragEnd` receives only the coordinate.                                                                                                                                                                                                                                      |
| `showsTraffic`                                                                                                                                       | ❌     | —                                                                | [\#116](https://github.com/gmi-software/react-native-better-maps/issues/116)                                                                                                                                                                                                                                                        |
| `showsBuildings`                                                                                                                                     | ❌     | —                                                                | [\#110](https://github.com/gmi-software/react-native-better-maps/issues/110)                                                                                                                                                                                                                                                        |
| `showsIndoors`                                                                                                                                       | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `showsIndoorLevelPicker`                                                                                                                             | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `showsMyLocationButton`                                                                                                                              | ❌     | —                                                                | Tracked as `myLocationButtonEnabled` in [\#112](https://github.com/gmi-software/react-native-better-maps/issues/112)                                                                                                                                                                                                                |
| `liteMode`                                                                                                                                           | 🚫     | —                                                                | Not planned (Android Google lite mode)                                                                                                                                                                                                                                                                                              |
| `legalLabelInsets`                                                                                                                                   | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `loadingEnabled` / `loadingIndicatorColor` / `loadingBackgroundColor`                                                                                | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `toolbarEnabled`                                                                                                                                     | ❌     | —                                                                | [\#111](https://github.com/gmi-software/react-native-better-maps/issues/111)                                                                                                                                                                                                                                                        |
| `minZoomLevel` / `maxZoomLevel` / `cameraZoomRange`                                                                                                  | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `onPanDrag`                                                                                                                                          | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `onLayout`                                                                                                                                           | 🚫     | —                                                                | Not forwarded on `MapView`. Wrap the map in a `View` if you need layout events.                                                                                                                                                                                                                                                     |
| `onUserLocationChange`                                                                                                                               | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `onMarkerSelect` / `onMarkerDeselect` / `onCalloutPress`                                                                                             | ❌     | —                                                                | Callout selection APIs: [\#15](https://github.com/gmi-software/react-native-better-maps/issues/15)                                                                                                                                                                                                                                  |
| `onMarkerDrag` / `onMarkerDragStart`                                                                                                                 | 🚫     | —                                                                | Only `onMarkerDragEnd` / `Marker.onDragEnd` exist                                                                                                                                                                                                                                                                                   |
| `kmlSrc` / `onKmlReady`                                                                                                                              | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `cacheEnabled`                                                                                                                                       | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `moveOnMarkerPress`                                                                                                                                  | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `userInterfaceStyle`                                                                                                                                 | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `userLocationPriority` / `userLocationUpdateInterval` / `userLocationFastestInterval` / `userLocationAnnotationTitle` / `userLocationCalloutEnabled` | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `zoomTapEnabled` / `zoomControlEnabled` / `scrollDuringRotateOrZoomEnabled`                                                                          | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `paddingAdjustmentBehavior`                                                                                                                          | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `compassOffset` / `appleLogoInsets` / `tintColor`                                                                                                    | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |
| `pointsOfInterestFilter` / `showsPointsOfInterests`                                                                                                  | 🚫     | —                                                                | POI **taps** are `onPoiPress`. Filtering the base-map POI set is not planned.                                                                                                                                                                                                                                                       |
| `onIndoorBuildingFocused` / `onIndoorLevelActivated` / `onDoublePress`                                                                               | 🚫     | —                                                                | Not planned                                                                                                                                                                                                                                                                                                                         |

#### MapView props that exist only here

These are public `MapViewProps` fields with no rn-maps equivalent. They are
part of the current TypeScript surface and belong in any completeness check.

| Prop                                                   | Status | Notes                                                                    |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| `markers` / `polylines` / `polygons` / `circles`       | ✅     | Bulk descriptors. Prefer `markers` over hundreds of `<Marker>` children. |
| `clusteringEnabled`                                    | ✅     | Built-in grid clustering. Per-marker opt-out: `clusterable={false}`.     |
| `onClusterPress`                                       | ✅     | `(markerIds: string[], coordinate: Coordinate) => void`                  |
| `onPolylinePress` / `onPolygonPress` / `onCirclePress` | ✅     | `(id: string) => void` for bulk overlays                                 |
| `markerEnteringAnimation` / `clusterEnteringAnimation` | ✅     | `false` \| `'system'` \| `{ preset, duration?, delay?, reduceMotion? }`  |

### MapViewRef methods

`MapViewRef` is exported from `react-native-better-maps`. Methods return
`Promise`s. If they are called before mount they reject with
`"MapView is not mounted"` ([\#131](https://github.com/gmi-software/react-native-better-maps/issues/131)).

| react-native-maps                                                     | Status | react-native-better-maps                                            | Notes                                                                                                                                                                                        |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getCamera()`                                                         | ✅     | `getCamera(): Promise<Camera>`                                      |                                                                                                                                                                                              |
| `setCamera(camera)`                                                   | ✅     | `setCamera(camera: Camera): Promise<void>`                          | Instant; no duration options object.                                                                                                                                                         |
| `animateCamera(camera, { duration })`                                 | 🔄     | `animateCamera(camera: Camera, duration?: number): Promise<void>`   | Duration is a **number** (ms), not `{ duration }`. The promise may resolve before the camera finishes moving ([\#136](https://github.com/gmi-software/react-native-better-maps/issues/136)). |
| `animateToRegion(region, duration)`                                   | ❌     | —                                                                   | [\#114](https://github.com/gmi-software/react-native-better-maps/issues/114). Workaround: `animateCamera({ center: { latitude, longitude } })` or set `region`.                              |
| `fitToCoordinates(coords, { edgePadding, animated })`                 | 🔄     | `fitToCoordinates(coordinates, padding?, animated?): Promise<void>` | Positional `EdgePadding` and `boolean`, not an options object.                                                                                                                               |
| `getMapBoundaries()`                                                  | 🔄     | `getVisibleRegion(): Promise<VisibleRegion>`                        | Four corners (`nearLeft` / `nearRight` / `farLeft` / `farRight`) instead of `{ northEast, southWest }`.                                                                                      |
| `pointForCoordinate` / `coordinateForPoint`                           | ❌     | —                                                                   | [\#113](https://github.com/gmi-software/react-native-better-maps/issues/113)                                                                                                                 |
| `takeSnapshot`                                                        | 🚫     | —                                                                   | Not planned                                                                                                                                                                                  |
| `fitToElements` / `fitToSuppliedMarkers`                              | 🚫     | —                                                                   | Not planned. Collect coordinates and call `fitToCoordinates`.                                                                                                                                |
| `addressForCoordinate`                                                | 🚫     | —                                                                   | Not planned                                                                                                                                                                                  |
| `setMapBoundaries` / `setIndoorActiveLevelIndex` / `getMarkersFrames` | 🚫     | —                                                                   | Not planned                                                                                                                                                                                  |

### Marker

Public `MarkerProps` plus rn-maps callout / child-view APIs.

Native title/subtitle callouts work. Custom callout views do not.

| react-native-maps                                                               | Status | react-native-better-maps                             | Notes                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------- | ------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coordinate`                                                                    | ✅     | `coordinate: Coordinate`                             | Invalid coordinates skip the marker with a `__DEV__` warning.                                                                                                                                                                                                                      |
| `title`                                                                         | ✅     | `title?: string`                                     | Default native callout title.                                                                                                                                                                                                                                                      |
| `description`                                                                   | 🔄     | `subtitle?: string`                                  | Rename `description` → `subtitle`.                                                                                                                                                                                                                                                 |
| `identifier`                                                                    | 🔄     | `id?: string`                                        | Stable overlay id. Prefer an explicit `id` (React `key` is not used today; [\#139](https://github.com/gmi-software/react-native-better-maps/issues/139)).                                                                                                                          |
| `draggable`                                                                     | ✅     | `draggable?: boolean`                                |                                                                                                                                                                                                                                                                                    |
| `image`                                                                         | ✅     | `image?: number \| { uri, width?, height?, scale? }` | `require()` and `{ uri }` work. `scale` is currently unused ([\#133](https://github.com/gmi-software/react-native-better-maps/issues/133)). Android `require()` images can fail in some dev builds ([\#129](https://github.com/gmi-software/react-native-better-maps/issues/129)). |
| `pinColor`                                                                      | 🔄     | `markerColor?: string`                               | Default pin color when `image` is omitted.                                                                                                                                                                                                                                         |
| `anchor`                                                                        | ✅     | `anchor?: { x, y }`                                  | Default `{ x: 0.5, y: 1 }`.                                                                                                                                                                                                                                                        |
| `centerOffset`                                                                  | ✅     | `centerOffset?: { x, y }`                            | Extra offset in dp (MapKit-style).                                                                                                                                                                                                                                                 |
| `rotation`                                                                      | ✅     | `rotation?: number`                                  | Degrees clockwise.                                                                                                                                                                                                                                                                 |
| `flat`                                                                          | ⚠️     | `flat?: boolean`                                     | Google Maps is native-flat; MapKit approximates with a view transform.                                                                                                                                                                                                             |
| `opacity`                                                                       | ✅     | `opacity?: number`                                   | `0..1`                                                                                                                                                                                                                                                                             |
| `zIndex`                                                                        | ✅     | `zIndex?: number`                                    | On `<Marker>` and bulk `MarkerDescriptor`.                                                                                                                                                                                                                                         |
| `onPress`                                                                       | 🔄     | `onPress?: () => void`                               | No event payload.                                                                                                                                                                                                                                                                  |
| `onDragEnd`                                                                     | 🔄     | `onDragEnd?: (coordinate: Coordinate) => void`       | Coordinate only.                                                                                                                                                                                                                                                                   |
| `onDrag` / `onDragStart`                                                        | 🚫     | —                                                    | Not planned                                                                                                                                                                                                                                                                        |
| `<Marker><View /></Marker>`                                                     | ❌     | —                                                    | Use a bitmap `image`. Tracked in [\#34](https://github.com/gmi-software/react-native-better-maps/issues/34) / ADR 0004.                                                                                                                                                            |
| `tracksViewChanges` / `tracksInfoWindowChanges` / `redraw()`                    | 🚫     | —                                                    | No child views to track.                                                                                                                                                                                                                                                           |
| `<Callout>` / `tooltip` / `onCalloutPress`                                      | ❌     | —                                                    | [\#15](https://github.com/gmi-software/react-native-better-maps/issues/15)                                                                                                                                                                                                         |
| `showCallout()` / `hideCallout()` / `redrawCallout()`                           | ❌     | —                                                    | [\#15](https://github.com/gmi-software/react-native-better-maps/issues/15). There is no `MarkerRef` today.                                                                                                                                                                         |
| `icon` (Google-only)                                                            | 🔄     | `image`                                              | Use `image` on every provider.                                                                                                                                                                                                                                                     |
| `calloutOffset` / `calloutAnchor`                                               | ❌     | —                                                    | [\#15](https://github.com/gmi-software/react-native-better-maps/issues/15)                                                                                                                                                                                                         |
| `tappable` (marker)                                                             | 🚫     | —                                                    | Markers are tappable when `onPress` is set.                                                                                                                                                                                                                                        |
| `stopPropagation`                                                               | 🚫     | —                                                    | Map `onPress` already does not fire for marker taps.                                                                                                                                                                                                                               |
| `animateMarkerToCoordinate`                                                     | 🚫     | —                                                    | Not planned                                                                                                                                                                                                                                                                        |
| `isPreselected` / `titleVisibility` / `subtitleVisibility` / `useLegacyPinView` | 🚫     | —                                                    | Not planned                                                                                                                                                                                                                                                                        |

#### Marker props that exist only here

| Prop                | Status | Notes                                                                       |
| ------------------- | ------ | --------------------------------------------------------------------------- |
| `clusterable`       | ✅     | Default `true` when `clusteringEnabled` is on.                              |
| `enteringAnimation` | ✅     | Per-marker override of `MapView.markerEnteringAnimation`. `false` opts out. |

### Polyline, Polygon, Circle

Child-component props are `PolylineProps`, `PolygonProps`, and `CircleProps`.
Bulk descriptors (`PolylineDescriptor`, `PolygonDescriptor`,
`CircleDescriptor`) accept a few extra native fields that the children do
**not** yet expose.

| react-native-maps                      | Status | react-native-better-maps            | Notes                                                                                                                                                                |
| -------------------------------------- | ------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coordinates` (line / polygon)         | ✅     | `coordinates: Coordinate[]`         | Invalid or too-short lists are skipped with a `__DEV__` warning.                                                                                                     |
| `center` + `radius` (circle)           | ✅     | `center`, `radius`                  | Radius is meters. Invalid center/radius skips the circle.                                                                                                            |
| `strokeColor` / `strokeWidth`          | ✅     | `strokeColor?`, `strokeWidth?`      | Hex `#RGB` / `#RGBA` / `#RRGGBB` / `#RRGGBBAA`.                                                                                                                      |
| `fillColor` (polygon / circle)         | ✅     | `fillColor?`                        |                                                                                                                                                                      |
| `tappable`                             | ✅     | `tappable?: boolean`                | Defaults to tappable when `onPress` is set. Bulk circles can disagree across providers ([\#98](https://github.com/gmi-software/react-native-better-maps/issues/98)). |
| `onPress`                              | 🔄     | `onPress?: () => void`              | No event payload. Apple polyline hit-testing can include the filled shape ([\#126](https://github.com/gmi-software/react-native-better-maps/issues/126)).            |
| `holes` on `<Polygon>`                 | ❌     | bulk `PolygonDescriptor.holes` only | Child `<Polygon holes>` is [\#97](https://github.com/gmi-software/react-native-better-maps/issues/97). GeoJSON polygons already emit holes.                          |
| `zIndex` on `<Polyline>` / `<Polygon>` | ❌     | bulk descriptors only               | Child components: [\#97](https://github.com/gmi-software/react-native-better-maps/issues/97).                                                                        |
| `zIndex` on `<Circle>`                 | ❌     | —                                   | [\#105](https://github.com/gmi-software/react-native-better-maps/issues/105)                                                                                         |
| `geodesic`                             | 🚫     | —                                   | Not planned                                                                                                                                                          |
| `lineDashPattern` / `lineDashPhase`    | ❌     | —                                   | [\#115](https://github.com/gmi-software/react-native-better-maps/issues/115)                                                                                         |
| `strokeColors` (gradient line)         | 🚫     | —                                   | Not planned                                                                                                                                                          |
| `lineCap` / `lineJoin` / `miterLimit`  | 🚫     | —                                   | Not planned                                                                                                                                                          |

Child components also accept optional `id?: string`.

### Other components

| react-native-maps                                    | Status | react-native-better-maps         | Notes                                                                                                                                                                                                                                |
| ---------------------------------------------------- | ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Geojson`                                            | ⚠️     | `Geojson`                        | Same idea; JS conversion into markers / polylines / polygons. `color` → `markerColor`. `markerComponent` and `lineDashPattern` are unsupported. `onPress(feature)` receives the source Feature. See [docs/geojson.md](geojson.md).   |
| `Callout` / `CalloutSubview`                         | ❌     | —                                | Native title/subtitle only. Custom callouts: [\#15](https://github.com/gmi-software/react-native-better-maps/issues/15)                                                                                                              |
| `UrlTile` / `WMSTile` / `LocalTile`                  | ❌     | —                                | [\#17](https://github.com/gmi-software/react-native-better-maps/issues/17)                                                                                                                                                           |
| `Overlay` (ground image)                             | 🚫     | —                                | Not planned                                                                                                                                                                                                                          |
| `Heatmap`                                            | 🚫     | —                                | Not planned                                                                                                                                                                                                                          |
| `MapViewDirections` (`react-native-maps-directions`) | ❌     | planned `@nitro-maps/directions` | Separate package, not in core. [\#6](https://github.com/gmi-software/react-native-better-maps/issues/6)–[\#10](https://github.com/gmi-software/react-native-better-maps/issues/10). Cross-link only — see [Directions](#directions). |

#### Geojson props (`GeojsonProps`)

| Prop                                                                                          | Status | Notes                                                                                             |
| --------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| `geojson`                                                                                     | ✅     | Object or JSON string                                                                             |
| `id`                                                                                          | ✅     | Overlay id prefix (default `'geojson'`)                                                           |
| `strokeColor` / `fillColor` / `markerColor` / `strokeWidth` / `title` / `zIndex` / `tappable` | ✅     | Defaults; simplestyle feature properties override them                                            |
| `onPress`                                                                                     | 🔄     | `(feature: GeojsonFeature) => void`                                                               |
| rn-maps `color`                                                                               | 🔄     | `markerColor`                                                                                     |
| rn-maps `markerComponent`                                                                     | ❌     | Default markers only ([\#34](https://github.com/gmi-software/react-native-better-maps/issues/34)) |
| rn-maps `lineDashPattern`                                                                     | ❌     | [\#115](https://github.com/gmi-software/react-native-better-maps/issues/115)                      |

## Platform caveats (iOS MapKit vs Android / Google)

From [docs/architecture.md](architecture.md) and the README capability matrix:

| Topic                   | `apple` iOS (MapKit)                       | `google` iOS                                   | `google` Android                                                                                                    |
| ----------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Default `provider`      | `apple`                                    | set `provider="google"`                        | `google`                                                                                                            |
| API key                 | None                                       | `GoogleMapsIosApiKey` + pod flag               | `com.google.android.geo.API_KEY`                                                                                    |
| `mapType="terrain"`     | Falls back to `standard`                   | Supported                                      | Supported                                                                                                           |
| `showsScale`            | Supported                                  | Unsupported                                    | Unsupported                                                                                                         |
| `followsUserLocation`   | Native follow                              | Location layer; follow is limited              | Location layer; no continuous follow ([\#104](https://github.com/gmi-software/react-native-better-maps/issues/104)) |
| `customMapStyle`        | Curated MapKit subset, iOS 16+             | Google Maps JSON                               | Google Maps JSON                                                                                                    |
| `Camera.altitude`       | Used                                       | Ignored (use `zoom`)                           | Ignored (use `zoom`)                                                                                                |
| `onPoiPress` identifier | Category only; no place id                 | `placeId`                                      | `placeId`                                                                                                           |
| Region events           | `MKCoordinateRegion`                       | Bounds-derived; may differ when tilted/rotated | Bounds-derived; may differ when tilted/rotated                                                                      |
| Clustering              | Custom grid engine                         | Custom grid engine                             | Custom grid engine                                                                                                  |
| Marker `flat`           | Approximated                               | Native                                         | Native                                                                                                              |
| Shape `zIndex`          | Markers only (MapKit has no shape z-order) | Supported on bulk polylines/polygons           | Supported on bulk polylines/polygons                                                                                |

User location: the library never prompts. Add usage strings / manifest
permissions yourself or through the Expo plugin.

## Before / after examples

Callbacks take values directly. Do not read `e.nativeEvent`.

### 1. Basic map + single marker

```tsx
// react-native-maps
import MapView, { Marker } from 'react-native-maps';

<MapView
  style={{ flex: 1 }}
  initialRegion={{
    latitude: 52.2297,
    longitude: 21.0122,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
  <Marker
    coordinate={{ latitude: 52.2297, longitude: 21.0122 }}
    title="Warsaw"
    description="Palace of Culture"
  />
</MapView>;
```

```tsx
// react-native-better-maps
import { MapView, Marker } from 'react-native-better-maps';

<MapView
  style={{ flex: 1 }}
  region={{
    latitude: 52.2297,
    longitude: 21.0122,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  }}
>
  <Marker
    coordinate={{ latitude: 52.2297, longitude: 21.0122 }}
    title="Warsaw"
    subtitle="Palace of Culture"
  />
</MapView>;
```

### 2. Camera animation via ref

```tsx
// react-native-maps
import { useRef } from 'react';
import MapView from 'react-native-maps';

const mapRef = useRef<MapView>(null);

mapRef.current?.animateCamera(
  { center: { latitude: 52.2297, longitude: 21.0122 }, zoom: 12 },
  { duration: 400 },
);

<MapView ref={mapRef} style={{ flex: 1 }} />;
```

```tsx
// react-native-better-maps
import { useRef } from 'react';
import { MapView, type MapViewRef } from 'react-native-better-maps';

const mapRef = useRef<MapViewRef>(null);

void mapRef.current?.animateCamera(
  { center: { latitude: 52.2297, longitude: 21.0122 }, zoom: 12 },
  400,
);

<MapView ref={mapRef} style={{ flex: 1 }} />;
```

`animateToRegion` is not implemented ([\#114](https://github.com/gmi-software/react-native-better-maps/issues/114)).
`fitToCoordinates` uses positional arguments:

```tsx
void mapRef.current?.fitToCoordinates(
  points,
  { top: 40, right: 40, bottom: 40, left: 40 },
  true,
);
```

### 3. Polylines and polygons

```tsx
// react-native-maps
import MapView, { Polyline, Polygon } from 'react-native-maps';

<MapView style={{ flex: 1 }}>
  <Polyline
    coordinates={route}
    strokeColor="#007AFF"
    strokeWidth={4}
    tappable
    onPress={(e) => console.log(e.nativeEvent)}
  />
  <Polygon
    coordinates={zone}
    holes={[innerHole]}
    fillColor="#007AFF33"
    strokeColor="#007AFF"
    zIndex={1}
  />
</MapView>;
```

```tsx
// react-native-better-maps
import { MapView, Polyline, Polygon } from 'react-native-better-maps';

<MapView
  style={{ flex: 1 }}
  // holes / zIndex are not on <Polygon> yet (#97). Use a bulk descriptor:
  polygons={[
    {
      id: 'zone',
      coordinates: zone,
      holes: [innerHole],
      fillColor: '#007AFF33',
      strokeColor: '#007AFF',
      zIndex: 1,
    },
  ]}
>
  <Polyline
    coordinates={route}
    strokeColor="#007AFF"
    strokeWidth={4}
    tappable
    onPress={() => console.log('route')}
  />
</MapView>;
```

### 4. Region change callbacks

```tsx
// react-native-maps — onRegionChange fires continuously; payload is often nativeEvent
<MapView
  onRegionChange={(region, details) => {
    console.log(region, details.isGesture);
  }}
  onRegionChangeComplete={(region) => setRegion(region)}
  onPress={(e) => console.log(e.nativeEvent.coordinate)}
/>
```

```tsx
// react-native-better-maps — begin/end once per user gesture; coordinate is the argument
<MapView
  onRegionChange={(region) => console.log('move started', region)}
  onRegionChangeComplete={(region) => setRegion(region)}
  onPress={(coordinate) => console.log(coordinate)}
/>
```

Programmatic `animateCamera` / `fitToCoordinates` do not emit region events
today ([\#137](https://github.com/gmi-software/react-native-better-maps/issues/137)).

### 5. Marker clustering

```tsx
// react-native-maps — typically a JS clusterer
import MapView, { Marker } from 'react-native-maps';
import { Clusterer } from 'react-native-clusterer';

<MapView region={region}>
  <Clusterer
    data={points}
    region={region}
    renderItem={(item) => <Marker {...item} />}
  />
</MapView>;
```

```tsx
// react-native-better-maps — native clustering on the provider
import { MapView, Marker } from 'react-native-better-maps';

<MapView
  clusteringEnabled
  onClusterPress={(markerIds, coordinate) => {
    console.log(markerIds, coordinate);
  }}
>
  <Marker coordinate={a} clusterable />
  <Marker coordinate={b} clusterable={false} />
</MapView>;
```

Cluster badge styling is not customizable yet
([\#107](https://github.com/gmi-software/react-native-better-maps/issues/107)).

### 6. Custom map style JSON

```tsx
// react-native-maps — style array
import mapStyle from './map-style.json';

<MapView provider={PROVIDER_GOOGLE} customMapStyle={mapStyle} />;
```

```tsx
// react-native-better-maps — JSON string + provider string
import mapStyle from './map-style.json';

<MapView provider="google" customMapStyle={JSON.stringify(mapStyle)} />;
```

On `provider="apple"`, only a curated subset is applied (iOS 16+). Transit
/`"all"` rules have known MapKit mapping bugs
([\#109](https://github.com/gmi-software/react-native-better-maps/issues/109)).

### 7. User location

```tsx
// react-native-maps
<MapView showsUserLocation followsUserLocation showsMyLocationButton />
```

```tsx
// react-native-better-maps
<MapView showsUserLocation followsUserLocation />
```

Request permission before enabling the layer. `followsUserLocation` is
reliable on Apple MapKit; on Google / Android it does not keep the camera
glued to the user — update `camera` yourself if you need that
([\#104](https://github.com/gmi-software/react-native-better-maps/issues/104)).
`showsMyLocationButton` is not implemented
([\#112](https://github.com/gmi-software/react-native-better-maps/issues/112)).

### 8. Bulk markers (better-maps-specific)

Hundreds or thousands of `<Marker>` children in rn-maps usually need a
clusterer and still serialize one view each. Better-maps can take a
descriptor array:

```tsx
// react-native-maps
<MapView>
  {points.map((point) => (
    <Marker
      key={point.id}
      identifier={point.id}
      coordinate={point.coordinate}
      title={point.title}
      description={point.subtitle}
    />
  ))}
</MapView>
```

```tsx
// react-native-better-maps
<MapView
  clusteringEnabled
  markers={points.map((point) => ({
    id: point.id,
    coordinate: point.coordinate,
    title: point.title,
    subtitle: point.subtitle,
  }))}
  onMarkerPress={(id) => console.log(id)}
/>
```

Treat descriptors as immutable — mutating `marker.coordinate.latitude` in
place is not detected. For GeoJSON at this scale, convert once with
`geojsonToOverlayDescriptors` and pass the result into `markers` /
`polylines` / `polygons`.

### 9. Directions (cross-link)

`MapViewDirections` is **not** in `react-native-better-maps`. A separate
`@nitro-maps/directions` package is planned:

- Scaffold: [\#6](https://github.com/gmi-software/react-native-better-maps/issues/6)
- Google Directions polyline: [\#7](https://github.com/gmi-software/react-native-better-maps/issues/7)
- Waypoints / modes / traffic: [\#8](https://github.com/gmi-software/react-native-better-maps/issues/8)
- Flexible inputs: [\#9](https://github.com/gmi-software/react-native-better-maps/issues/9)
- Example + **react-native-maps-directions migration guide**: [\#10](https://github.com/gmi-software/react-native-better-maps/issues/10)
- Native MapKit `MKDirections`: [\#11](https://github.com/gmi-software/react-native-better-maps/issues/11)

Until that ships, decode a route yourself and draw a `<Polyline>` (or a bulk
`polylines` descriptor). Do not expect a drop-in `apikey` / `origin` /
`destination` component.

## Known react-native-maps New Architecture issues this stack avoids

These are facts about architecture, not a feature comparison:

- rn-maps still reports Fabric overlay / marker bugs such as
  [\#5932](https://github.com/react-native-maps/react-native-maps/issues/5932)
  and [\#5909](https://github.com/react-native-maps/react-native-maps/issues/5909).
- better-maps never uses the legacy bridge. Overlay children are collected in
  JS and sent as Nitro descriptor structs (JSI), then rendered by the
  provider adapter.
- Marker taps and map `onPress` are separate on purpose, which avoids the
  “press fires twice” class of Fabric bugs.
- The cost of that model is the gaps above: no live RN marker children, no
  custom `Callout` subtree, and no per-overlay native view.

## Maintenance

When you change a public TypeScript export, update the matching table here:

| Source                          | Tables                               |
| ------------------------------- | ------------------------------------ |
| `package/src/types/map.ts`      | MapView props                        |
| `package/src/types/overlays.ts` | Marker / Polyline / Polygon / Circle |
| `package/src/types/geojson.ts`  | Geojson                              |
| `package/src/types/ref.ts`      | MapViewRef                           |
| `package/src/index.ts`          | Component and type export list       |

Also bump the “last reviewed against” line (package version + `main` SHA).

Related living docs: [Architecture](architecture.md),
[Expo setup](expo-setup.md), [GeoJSON](geojson.md), [Roadmap](roadmap.md).
