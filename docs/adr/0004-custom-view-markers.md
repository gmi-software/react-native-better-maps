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
- Fixed bounds define anchors, clipping, and touch regions. JSX order defines host order. Offscreen hosts are hidden; application-owned timers/worklet work are not automatically suspended.

See the [public contract](../custom-marker-views.md) for exact API and limitations.

## Alternatives

- **Snapshot all JSX:** reuses the descriptor/image path, but changes live animation and interaction semantics and introduces repeated capture/upload cost.
- **SDK annotation hosts / Google icon views:** retain more SDK marker features, but have different ownership, snapshot, and interaction behavior across providers.
- **Native projected live hosts:** preserve live Fabric content and avoid snapshot work, at the cost of explicit projection, mounting, gestures, and clipping. This is the implemented prototype.
- **Per-frame JavaScript screen projection:** adds camera events and many JS/native updates to the frame path; excluded from this design.

## Consequences and acceptance

Live hosts do not participate in SDK clustering, collision, depth occlusion, dragging, callouts, or ground-plane rotation. Their explicit dimensions and finite number are part of the workload. The package cannot remove the intrinsic rendering cost of arbitrary user JSX.

The target is no material regression against the same provider/device baseline for an explicitly measured workload. Google iOS documents a 60 FPS maximum for its map renderer; a 120 Hz display callback does not override that limit. Provider acceptance must be separate.

The first physical iPhone experiment retained near-120 Hz callback cadence for static hosts and the 10/50-marker animation cases, but 200 animated-layout markers regressed, as did transformed markers in the hottest pass. These callback results are not presented-frame evidence. The unrestricted 120 FPS condition is therefore not accepted. Follow-up controls compare identical JSX outside geographic hosts, and presentation/thermal traces remain required.

[Experiments and reproduction](../../experiments/custom-markers/README.md) · [Physical device results](../research/custom-marker-device-results.md)
