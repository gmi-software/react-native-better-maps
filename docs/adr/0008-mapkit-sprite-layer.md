# ADR 0008: MapKit sprite layer

## Status

Accepted

## Context

After the frame-budgeted pipeline (ADR 0006) the frames MapKit still drops come from
annotation views: at an octave crossing of a zoom sweep the set on screen changes
wholesale, and even with adds spread over frames and one image layer per pin, MapKit
lays every new `MKAnnotationView` out on the main thread. The signposts in ADR 0007 put
the compute side under a frame on the background queue while the main-thread apply of
scenario N reached 15 ms inside MapKit. The audit's answer was a bulk rendering path
through `MKOverlayRenderer`, left for later; this is it.

## Decision

- **`markerRendering="sprites"` on the Apple provider.** The displayed markers and cluster
  badges are drawn into map tiles by `MarkerSpriteRenderer`, an `MKOverlayRenderer` on a
  world-sized overlay above the labels. MapKit calls it per tile on its own threads and
  composites the tiles on the GPU. What the main thread keeps is the sprite publish, a
  sort and a snapshot swap that stays under 1.5 ms at 2,000 sprites; what it loses is the
  annotation-view layout of every viewport change. The zoom sweeps and the 100,000-marker
  scenario gain from that; a plain pan, which only touches edge tiles, measures the same as
  views (see `docs/benchmarks.md`).
- **Same pipeline, different apply.** The store, index, viewport filter, clustering and
  diffing are untouched; sprite mode changes only what the controller does with a diff.
  Sprites are applied at once (a dictionary update, no frame budget needed) and published
  as an immutable snapshot the renderer reads under a lock. Draggable markers, and the
  marker whose callout is open, go through the annotation-view path and its scheduler.
- **Interaction stays.** Taps are hit-tested against the snapshot, topmost sprite first.
  A marker without a title fires `onMarkerPress` directly; one with a title or subtitle is
  promoted to a selected annotation view so MapKit shows its callout, and its sprite comes
  back when the callout closes. Cluster taps fire `onClusterPress` and zoom to the cluster.
- **Opt-in, not automatic.** Sprites do not run entering animations, ignore `pinStyle`,
  and scale with the tiles during a pinch until MapKit has drawn new ones. Switching paths
  by visible count would make those differences appear and disappear mid-session, so the
  app chooses once.

## Consequences

- One more rendering path on MapKit to keep in step with the view path: geometry
  (`MapMarkerAnnotation.centerOffset`), the pin image and the cluster badge are shared
  code, so a change to the look reaches both.
- The pinch artifact is MapKit's: every overlay renderer's content, including polylines,
  scales with the tiles until the re-render lands. It is documented rather than worked
  around; a screen-space sprite view would avoid it at the cost of per-frame main-thread
  repositioning, which is the cost the sprite layer removes.
- Callout promotion adds a view for one marker at a time, which is the annotation model's
  ordinary cost.

## Alternatives considered

- **A `CALayer` per sprite in a view above the map.** Cheap to add, but every layer has to
  be repositioned on the main thread on every frame of a gesture, which is the class of
  work MapKit already does for annotation views.
- **Automatic bulk mode above a visible-count threshold.** Rejected for the mid-session
  behavior change described above.
- **Drawing every marker in a tile from the spatial index, skipping the viewport filter.**
  Would draw all 10,000 pins of scenario N at once; the filter exists for legibility as much
  as for cost, and keeping it makes sprite mode show exactly what view mode shows.
