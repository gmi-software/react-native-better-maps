# ADR 0005: Native Apple Maps POI detail presentation

## Status

Accepted

## Context

`onPoiPress` (issue #33) reports taps on provider-owned points of interest as typed events on
Apple Maps and Google Maps. Some apps want the provider's own place-detail UI instead of
rebuilding cards, sheets, and callouts in React Native.

Apple MapKit has a real native surface for this on iOS 18+: `MKAnnotationView.selectionAccessory`
accepts `MKSelectionAccessory.mapItemDetail(...)`, which works for `MKMapFeatureAnnotation` and
can present the place as a callout, a sheet, or an "Open in Maps" affordance. The Google Maps
SDK for iOS and Android exposes POI taps only as events; it has no native place-detail surface.

The library targets iOS 16.0, so the MapKit API is available at compile time but must be gated
at runtime.

## Decision

- Add an **Apple-only** prop, `applePoiDetailPresentation`, with the values `'automatic'`,
  `'callout'`, `'sheet'`, and `'openInMaps'`. The values map 1:1 onto MapKit's
  `MapItemDetailPresentationStyle` (`'callout'` uses the automatic callout style). Omitting the
  prop disables native details; there is no `'disabled'` string.
- The prop is typed on `provider="apple"` and on the omitted-provider props (iOS defaults to
  Apple), and rejected with `never` on `google`, `openstreetmap`, and `mapbox`, following the
  `googleMapId` / `showsScale` convention. Android and the iOS Google adapter store the value
  and ignore it.
- The prop is **independent of `onPoiPress`**: either one enables
  `MKMapView.selectableMapFeatures = .pointsOfInterest`. When both are set, the event is
  emitted immediately and the native details open for the same tap. There is no separate flag
  to decouple them.
- **Selection lifecycle**: with a presentation configured, the selected POI stays selected so
  MapKit can show the callout or sheet. Without one (or on iOS < 18), the POI is deselected
  right after `onPoiPress` is emitted, which is what #33 specified.
- **Degradation**: on iOS 16 and 17 the prop is a silent no-op. POI taps still emit
  `onPoiPress`, and the selection is cleared. The limitation is documented in the README and
  the provider feature matrix rather than warned about at runtime.
- The accessory is supplied through the iOS 18 `mapView(_:selectionAccessoryFor:)` delegate
  hook, so MapKit keeps rendering its own POI annotation view; the library never replaces
  the feature view or copies its icon style.

## Consequences

- Apps get MapKit's own place details with one prop and no React Native UI work.
- The API deliberately does not promise Google parity. If the Google Maps SDK ever exposes a
  native place-detail surface, it should get its own provider-specific prop rather than a
  shared one.
- The `'sheet'` style relies on MapKit presenting from the map view's nearest view controller.
  In a React Native app that is the root view controller or the controller of a `Modal`. When no
  presenter is available, `ApplePoiDetailPresentation.toMKSelectionAccessory(presentedFrom:)`
  falls back from `.sheet` to `.callout` so place details still appear.
- React Native POI detail components, custom callout content, and cross-provider parity remain
  out of scope.
