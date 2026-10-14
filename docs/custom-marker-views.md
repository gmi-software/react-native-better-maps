# Live JSX markers (`MarkerView`)

`MarkerView` draws a marker with live React Native content: state, `Pressable`, Reanimated animations and anything else a view can hold. Its JSX stays in Fabric. The map moves it with its native projection on every camera frame: no bitmap snapshots, and no JavaScript while the camera moves.

```tsx
import { MapView, MarkerView } from 'react-native-better-maps';

<MapView style={{ flex: 1 }} clusteringEnabled renderCluster={renderCluster}>
  {places.map((place) => (
    <MarkerView
      key={place.id}
      coordinate={place.coordinate}
      width={76}
      height={40}
      anchor={{ x: 0.5, y: 1 }}
    >
      <Pressable onPress={() => select(place.id)} style={styles.bubble}>
        <Text>{place.price} zł</Text>
      </Pressable>
    </MarkerView>
  ))}
</MapView>;

const renderCluster = (cluster: MarkerViewCluster) => (
  <MarkerView
    coordinate={cluster.coordinate}
    width={52}
    height={52}
    anchor={{ x: 0.5, y: 0.5 }}
  >
    <Pressable onPress={() => cluster.onPress()} style={styles.cluster}>
      <Text>{cluster.count}</Text>
    </Pressable>
  </MarkerView>
);
```

The example app's **Live JSX markers** scenario shows 120 price bubbles with press feedback, Reanimated pulses and JSX cluster badges.

## Props

| Prop              | Behavior                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `coordinate`      | Where the anchor point goes. Changing it moves the marker and its cluster membership.                                                                         |
| `width`, `height` | Fixed size in points / dp. It bounds layout, clipping and touches, and is what `anchor` refers to. Animate content inside it, not the marker's own size.      |
| `anchor`          | Point of the marker placed on `coordinate`, as fractions of its size. Default bottom-center, `{ x: 0.5, y: 1 }`. Values outside 0…1 offset the marker.        |
| `id`              | Identifies it in cluster membership and `onClusterPress`. `Marker` and `MarkerView` share one set of ids; it defaults to the React key, then to the position. |
| `clusterable`     | Default true: joins clusters when `clusteringEnabled` is set.                                                                                                 |
| `children`        | Live React Native content.                                                                                                                                    |

Like every overlay, a `MarkerView` must be a direct child of `MapView` (arrays from `.map` are fine). Put your own component inside it, not around it. A marker with an invalid coordinate, size or anchor is skipped with a development warning, as other overlays are.

## Clusters

`MarkerView` and `Marker` children feed one native clustering pipeline and can share a cluster. Without `renderCluster`, clusters keep the SDK badge. With it, each cluster is drawn by the `MarkerView` it returns. The cluster's `coordinate`, `count` and `markerIds` come from native; its `onPress` calls `onClusterPress` and zooms to its markers, as a press on a default badge does. The map sets the returned marker's `coordinate`, and keeps its React state while the count changes.

A live marker exists only while the pipeline shows it. Grouped into a cluster, or left far off screen in a dataset over 500 markers, it is **unmounted**, so hidden animated subtrees cost nothing. Keep selection and other state that has to survive that in your app, not in the marker.

## Touches and gestures

The marker owns touches that start on it: a tap reaches its `Pressable`, not the map's `onPress`, a POI or an SDK marker beneath it. A drag or pinch that starts on a marker still pans or zooms the map, unless a view inside the marker, such as a `ScrollView`, claims it first.

`Pressable` stays pressed through small finger movements: the marker's shadow node reports its projected position, so `measure()` sees it where it is drawn.

## How it stays fast

- **Per camera frame** the native side projects each mounted marker once, snaps it to the pixel grid and sets a translation. One projection snapshot is reused for every marker. Nothing reaches JS; no Yoga layout runs.
- **Markers off screen** are hidden, which takes them out of drawing and hit-testing.
- **JS hears only display-set changes**, when markers cluster, uncluster or leave a large dataset's viewport, never per frame. A live marker that only moved does not trigger it either.
- **Content animations** run in Fabric like anywhere else. Animate `transform` and `opacity` (Reanimated runs those on the UI thread); animating `width`, `height` or text re-runs layout every frame and costs as much as it does outside a map.

Live markers are drawn over the map surface, in children order, above SDK annotations. They are screen-aligned: they do not take part in SDK collision, pitch occlusion, dragging, callouts or flat ground-plane rotation. Use `Marker` for those, and for large static datasets, where an SDK image is much cheaper than a live view.

On Android, Google Maps renders on its own surface and reports each camera frame after drawing it, so during fast pans live markers can trail the map by about a frame. Google Maps on iOS renders at most 60 FPS, whatever the display refresh rate.

## Implementation

| Piece                                      | Role                                                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `MarkerView.nitro.ts`                      | Nitro view with `coordinate` and `anchor`. Fabric lays it out at the map's origin with the fixed size.                                        |
| `NitroMapContainerView` (iOS, Android)     | The map's Fabric view. Mounts hosts over the SDK view and moves them on every camera callback.                                                |
| `NitroMarkerContentView` (iOS, Android)    | A marker's native view: projects, culls and publishes its translation.                                                                        |
| `cpp/MarkerProjectionRegistry`             | Translations by Fabric tag, read by the patched `HybridMarkerViewShadowNode::getTransform()` so `measure()` matches the screen.               |
| `MarkerViewRenderRegistry` (Swift, Kotlin) | Takes live markers and JSX clusters out of each pipeline diff before the SDK sees it, and publishes the displayed set to JS when it changes.  |
| `scripts/patch-nitrogen-generated.mjs`     | Lets the generated Nitro views take Fabric children, and installs the shadow-node transform. Fails loudly if Nitrogen's output changes shape. |
