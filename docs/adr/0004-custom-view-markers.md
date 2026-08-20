# ADR 0004: Custom view markers

## Status

Proposed

## Context

Today markers are **serialized descriptors**, not React Native child views. `<Marker />`
returns `null`; its props are collected in `MapView.tsx` into `MarkerDescriptor[]` and
passed as a single prop on the `MapView` HybridView. Native code renders SDK objects
(`MKAnnotation` / `MKAnnotationView` on Apple, bitmap-backed `GMSMarker` on Google).
Appearance customization is limited to a **bitmap image** (`MarkerDescriptor.image`); any
`children` passed to `<Marker>` are ignored.

`react-native-maps` supports `<Marker>{arbitraryJSX}</Marker>`, where children are real RN
views. This is a fundamentally different rendering model from the current bulk-descriptor
pipeline and is a common migration blocker.

### Platform constraint (the crux)

| Platform / SDK | Can a marker be a "live" view? |
| --- | --- |
| **Apple MapKit** | Yes — `MKAnnotationView` can host any `UIView` (live, interactive RN views) |
| **Google Maps (iOS + Android)** | No — the marker icon is a **bitmap only**; a view must be snapshotted to a bitmap and re-snapshotted on change |

`react-native-maps` handles this by hosting a live view on MapKit and snapshotting children
to a bitmap on Google Maps. Any solution here must accept the same asymmetry.

## Decision

Add custom-view markers as a **separate, opt-in capability** alongside — not replacing —
the existing descriptor pipeline. These are two distinct contracts:

- `<Marker image=... />` — the high-throughput bulk path (hundreds/thousands of markers,
  bitmaps, clustering, viewport culling). Unchanged.
- `<MarkerView coordinate=...>{JSX}</MarkerView>` — a new opt-in, heavier path for a
  bounded number of custom-view markers.

Rendering follows **Option C (hybrid)**: live views where the SDK allows (MapKit),
bitmap snapshot where it does not (Google Maps on both iOS and Android). The public API is
identical across platforms; only the native implementation differs per backend.

Keeping these as separate types (rather than adding `children` + nullable fields to the
existing `Marker` descriptor) follows the API-design rule of splitting distinct workflows
into distinct types instead of overloading one object.

### Considered alternatives

- **Option A — snapshot only (JS/view-shot → existing `image` pipeline).** Fastest,
  cross-platform, reuses clustering. But static: no live interactivity/animation, every
  content change requires a re-snapshot. Adopted as the **Phase 1 MVP**, not the end state.
- **Option B — live native subviews everywhere.** Not possible on Google Maps (bitmap-only
  icons); would require manually positioned overlay views with z-order/gesture problems.
- **Option C — hybrid (chosen).** Live on MapKit, snapshot on Google. Closest to
  `react-native-maps` behavior with the least fighting against each SDK.

## Proposed API

### Nitro spec (new HybridView)

```typescript
// package/src/native/specs/MarkerView.nitro.ts
import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules'
import type { Coordinate } from '../../types/coordinate'
import type { MarkerAnchor, MarkerPoint } from './overlays'

export interface MarkerViewProps extends HybridViewProps {
  coordinate: Coordinate
  anchor?: MarkerAnchor
  centerOffset?: MarkerPoint
  draggable?: boolean
  /**
   * Rendering strategy on backends that support live views (MapKit).
   * Google Maps always snapshots (SDK limitation).
   * @default 'auto'
   */
  renderMode?: 'auto' | 'snapshot'
  zIndex?: number
}

export interface MarkerViewMethods extends HybridViewMethods {
  /** Force a re-snapshot on bitmap backends after child content changes. */
  redraw(): Promise<void>
}

export type MarkerView = HybridView<MarkerViewProps, MarkerViewMethods>
```

Add a `MarkerView` autolinking entry to `nitro.json` (separate `HybridMarkerView`
implementation class on iOS and Android).

### React usage

```tsx
<MapView>
  <MarkerView coordinate={{ latitude, longitude }} onPress={...}>
    <View style={styles.bubble}>
      <Text>Custom!</Text>
    </View>
  </MarkerView>
</MapView>
```

`<MarkerView>` is a real Nitro HybridView (`getHostComponent`) that renders its children
natively — unlike the null-rendering `<Marker>`.

## Implementation plan (phased)

### Phase 0 — quick win (independent)

Done: iOS Google applies `MarkerDescriptor` image, anchor, centerOffset, rotation, flat,
and opacity so `<Marker image>` is consistent across MapKit, iOS Google, and Android Google.

### Phase 1 — MVP custom views (Option A)

- Add `children` support that renders off-screen and snapshots to a bitmap (prefer a native
  snapshot; `react-native-view-shot` optional), feeding the existing
  `MarkerDescriptor.image` pipeline. Delivers working cross-platform custom markers quickly.

### Phase 2 — full `MarkerView` (Option C)

- New `MarkerView` Nitro HybridView hosting the RN child subtree natively.
- `MapView` native code detects mounted child `MarkerView`s in its native view hierarchy.
- **iOS Apple / MapKit:** embed the live hosted `UIView` in an `MKAnnotationView`; reuse
  existing anchor/center-offset logic.
- **iOS Google + Android Google:** snapshot the hosted view to a bitmap
  (`UIGraphicsImageRenderer` / `Canvas`+`Bitmap`) → `GMSMarker.icon` / `BitmapDescriptor`;
  re-snapshot on `redraw()` or layout change. Reuse `MarkerIconFactory` (Android).
- Implement `prepareForRecycle` (state reset) and `memorySize` (bitmaps) on the hosts.
- Follow native code rules: `final` classes, one top-level type per file, converters in
  their own extension files.

## Open items to verify before Phase 2

- Confirm, against **current** Nitrogen docs/source, the supported model for HybridView
  `children` and for mounting child views into the parent map's native hierarchy (do not
  rely on remembered API details).

## Consequences

- The existing bulk descriptor + clustering path is untouched; custom views are additive.
- Behavior is asymmetric by necessity: live/interactive on MapKit, static bitmap on Google
  Maps. `renderMode` and `redraw()` make the snapshot semantics explicit.
- Custom-view markers are intended for a bounded count; large marker sets should keep using
  the descriptor/image path.
- Enables a smoother migration path from `react-native-maps` for view-backed markers.
