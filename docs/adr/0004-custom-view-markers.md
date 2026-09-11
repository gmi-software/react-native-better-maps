# ADR 0004: Custom view markers

## Status

Proposed — live-host implementation available; performance acceptance remains open.

## Context

`Marker` elements are serialized descriptors. Their native SDK objects support images, clustering, dragging, and callouts, but their JSX children are not mounted. The requested custom-marker contract includes arbitrary live React Native JSX and internal animations while preserving map smoothness.

The earlier proposal used live MapKit annotation views and snapshots on Google. That does not preserve interactive animated JSX across providers. Google iOS `iconView` uses snapshots, and Android's advanced-marker view API has separate renderer and performance constraints. A native projected overlay is a distinct alternative to those SDK icon APIs. See the [SDK source investigation](../research/custom-marker-sdk-sources.md).

The optimized UIKit experiment exceeded the entire 8.33 ms interval when taking 50 simple layer snapshots in a batch. This is simulator CPU evidence against capturing every animated marker on every frame, not a measured Google SDK cost or a device FPS claim.

## Proposed decision

Add `MarkerView` as a separate live Fabric component. Keep `Marker` descriptors for SDK annotation features and large static datasets.

```tsx
<MapView>
  <MarkerView coordinate={{ latitude, longitude }} width={96} height={48}>
    <Pressable onPress={selectPlace}>
      <Animated.View style={animatedStyle} />
      <Text>Custom content</Text>
    </Pressable>
  </MarkerView>
</MapView>
```

The native spec carries `coordinate` and optional `anchor`; standard Fabric layout receives explicit width and height. Child state and animations remain in React Native. Camera movement projects coordinates and moves the outer native host on the UI thread. It does not serialize child content, capture bitmaps, or send screen positions through JavaScript.

- iOS components explicitly forward Fabric mount/unmount into Swift containers. Hosts mount within the SDK surface so SDK map gestures remain ancestors; provider replacement preserves the existing Fabric hosts.
- Android components use ViewGroup managers with separate Fabric child indexing. Native gesture dispatch gives descendants a chance to claim a gesture before forwarding unclaimed map gestures to the SDK surface.
- The Nitrogen compatibility script validates generated patch targets and supports repeated execution without duplicate methods.
- Fixed bounds define anchors, clipping, and touch regions. JSX order defines host order. Offscreen hosts are hidden; the native display set unmounts clustered-away/filtered subtrees. External application timers still need cleanup.

See the [public contract](../custom-marker-views.md) for exact API and limitations.

## Alternatives

- **Snapshot all JSX:** reuses the descriptor/image path, but changes live animation and interaction semantics and introduces repeated capture/upload cost.
- **SDK annotation hosts / Google icon views:** retain more SDK marker features, but have different ownership, snapshot, and interaction behavior across providers.
- **Native projected live hosts:** preserve live Fabric content and avoid snapshot work, at the cost of explicit projection, mounting, gestures, and clipping. This is the implemented prototype.
- **Per-frame JavaScript screen projection:** adds camera events and many JS/native updates to the frame path; excluded from this design.

## Consequences and acceptance

Live descriptors participate in the shared native cluster engine. Their Fabric hosts do not participate in SDK collision, depth occlusion, dragging, callouts, or ground-plane rotation. Their explicit dimensions and finite number are part of the workload. The package cannot remove the intrinsic rendering cost of arbitrary user JSX.

The target is no material regression against the same provider/device baseline for an explicitly measured workload. Google iOS documents a 60 FPS maximum for its map renderer; a 120 Hz display callback does not override that limit. Provider acceptance must be separate.

The corrected v3 physical runs retained near-120 Hz callback cadence for static/transform hosts, while 200 animated-width hosts and the same JSX in ordinary overlays both fell to about 51–55 callbacks/s. Earlier duration-error runs are excluded from moving-camera acceptance. Actual surface traces did not establish a sustained 120 FPS map baseline in these device conditions. These are pre-clustering results; custom cluster expansion/collapse needs separate physical validation before accepting the performance condition.

[Experiments and reproduction](../../experiments/custom-markers/README.md) · [Physical device results](../research/custom-marker-device-results.md)

## Cluster integration

Live marker descriptors share the existing native cluster engine with SDK markers. A render registry separates SDK objects from the visible Fabric display set. `renderCluster` supplies a live `MarkerView` for cluster badges; otherwise existing native badges remain available. Clustered-away React subtrees unmount to remove their animation/layout work. Persistent marker state therefore belongs in application data. The performance gate includes cluster expansion/collapse and fully expanded markers, not just a zoomed-out clustered screenshot.
