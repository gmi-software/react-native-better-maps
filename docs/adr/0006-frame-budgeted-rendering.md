# ADR 0006: Frame-budgeted marker rendering

## Status

Accepted

## Context

After [ADR 0005](0005-marker-collection-store.md) the transport is O(Δ), but the render
layer still applied every viewport diff in one main-thread pass. Zooming into a dense area
or crossing a cluster octave produced diffs of several hundred adds and removals; on
MapKit each add was an `MKMarkerAnnotationView`, a small view tree that MapKit lays out
on the main thread every frame, so the frame that applied the diff ran for 100–300 ms and
every later frame paid for the views that stayed. The MapKit live refresh during gestures
ran off a wall-clock `Timer`, so its applies landed at arbitrary points in a frame, and
clustering rebuilt every bucket from scratch on every refresh even when a pan within one
zoom octave had only moved the viewport by a few cells.

The performance audit rated these the next items after the transport: bounded apply
passes with a frame budget (P1), lightweight MapKit annotation views (P1) and an
incremental cluster cache, plus vsync-aligned refresh (P3).

## Decision

- **A frame-budgeted apply scheduler per map.** `MarkerApplyScheduler` (Swift) and
  `MarkerApplyQueue` + `MarkerApplyScheduler` (Kotlin) hold one pending diff. Each step
  applies all removals first, then a bounded number of adds sorted by distance to the
  viewport centre, then retained updates until a 2 ms budget is spent. The add count
  starts at 32, halves after a frame longer than 1.5× the display interval and grows by
  half after a frame within 1.1× of it, between 8 and 256, but never above three quarters
  of the last count that dropped a frame; that ceiling creeps up by one per good frame, so
  a one-off hitch does not pin the rate and a real limit is probed slowly. The scheduler runs a
  `CADisplayLink` / `Choreographer` callback only while work is pending. A new diff
  replaces the pending one: diffs are computed against what is on the map, so anything
  not yet applied is either in the new diff again or no longer wanted.
- **Flat pins by default on MapKit.** Image-less markers use `NitroFlatPinAnnotationView`,
  an `MKAnnotationView` with one pre-rendered pin image per screen scale. `pinStyle="system"`
  keeps `MKMarkerAnnotationView`. Google providers are unaffected.
- **Vsync-aligned live refresh.** The MapKit adapter's 10 Hz `Timer` is replaced by a
  display link that triggers a viewport refresh at most every 100 ms while the camera
  moves and is stopped otherwise.
- **Octave cache for clustering.** `ClusterOctaveCache` keeps the buckets of the cells
  that were fully inside the previous padded viewport, keyed by cell, for as long as the
  cell size (zoom octave) and the dataset generation stay the same. Cells that entered are
  accumulated from the candidates; cells that left are dropped. Edge cells that the
  candidate region only partially covers are never cached. The union-find merge works on
  copies so cached buckets are not mutated. The cache is off across the antimeridian,
  where cell keys depend on the viewport's own longitude reference.

## Consequences

- The worst frame of a viewport change is bounded by the per-frame add count instead of
  the diff size. During a large change the map fills from the centre outwards over a few
  frames.
- Apple markers look different by default. The flat pin is drawn to resemble the system
  marker; apps that want the balloon and its animations set `pinStyle="system"`.
- Entering animations on MapKit: `fade` and `fade-scale` work on flat pins; `system` has
  no drop animation there.
- A diff superseded mid-way leaves the map exactly as the next diff expects; there is no
  partial-state bookkeeping beyond the versions of what was actually applied.
- The cluster cache holds about one padded viewport of buckets per map. Any dataset change
  invalidates it, so live-updating clustered datasets get no reuse; static datasets get
  reuse for every pan within an octave.

## Alternatives considered

- **A fixed chunk size per frame.** Simpler, but the right number differs by SDK, device
  and view class. The observed frame interval is the only signal that includes what the
  SDK does after our call returns.
- **Measuring our own apply time as the budget.** MapKit and Google Maps create views and
  upload icons after the apply call, in their own layout pass, so the time inside
  `addAnnotations` says little about the frame's cost.
- **An `MKOverlayRenderer` sprite layer for bulk markers.** Would remove per-marker views
  entirely above a few hundred visible markers, at the cost of a second rendering path
  and no per-marker hit testing. Left for a later phase; the scheduler and flat pins
  keep the annotation model.
