# ADR 0005: Native marker store fed by delta batches

## Status

Accepted

## Context

Until now the whole marker dataset travelled as one Fabric prop, `markers: MarkerDescriptor[]`.
Any change to the array re-serialized every marker: about 27 JSI property reads per marker on
the JS thread, a `std::vector<MarkerDescriptor>` rebuild in the shadow tree, two more copies
into Swift on iOS, and a per-marker JNI object graph built on the UI thread on Android. Moving
one marker in a 10,000-marker dataset cost the same as sending all 10,000. The performance
audit (2026-09) rated this the single most valuable thing to fix: every other large-dataset
finding (main-thread stalls, four resident copies, impossible animated markers, O(k) cluster
press payloads) was downstream of the transport.

## Decision

Markers no longer cross the bridge as a prop.

- **Native store.** A `MarkerCollection` Nitro HybridObject owns a `MarkerStore`: flat
  latitude/longitude/flag arrays, a version per marker, one descriptor per marker, and a grid
  spatial index over integer handles. There is one native copy of the dataset.
- **Integer handles, assigned by JS.** The JS side keeps the last descriptor it sent for every
  id, assigns dense handles and reuses freed ones. Native code never needs an id → handle map;
  ids are only read back for events and `getClusterMembers`.
- **Packed batches.** Every update is one `applyBatch(ArrayBuffer, string[])` call. The buffer
  holds fixed-size little-endian records (96 bytes per upsert, 4 per removal, 24 per position
  update) and the string table carries each distinct string once. Removals are applied before
  upserts so a freed handle can be reused in the same batch. The layout is documented in
  `src/markers/markerBatch.ts` and mirrored by `MarkerBatchDecoder.swift` / `.kt`.
- **Decode off the JS thread.** `applyBatch` validates the header, copies the bytes and returns.
  A store thread decodes them under the store lock, updates the arrays and the index in place,
  rebuilds the index bounds only when a marker landed outside them, then notifies attached map
  views on the main thread.
- **Handle-indexed pipeline.** The per-map pipeline queries the index for candidate handles,
  clusters or thins them using the flat arrays, materializes descriptors only for the elements
  that will be displayed, and diffs by `(handle, id)` against what is on screen. Cluster badges
  keep member handles; their version is a hash of count, centroid and bounds, not a sort of
  every member id.
- **The old API is sugar.** `markers` and `<Marker>` children compile to the same batches
  through a collection `MapView` owns. `MarkerCollection` / `useMarkerCollection` and the
  `markerCollection` prop expose the store directly, with `updatePositions` for animated and
  live markers.
- **Lighter cluster presses.** `onClusterPress` receives `{ clusterId, count, coordinate }` and
  `MapViewRef.getClusterMembers(clusterId)` resolves ids on demand.

## Consequences

- One-marker updates are O(Δ) on every thread and in every layer. The JS thread pays a
  structural comparison per marker on the sugar path (`set` with a new array) and nothing per
  unchanged marker on the collection path.
- `onClusterPress` changes signature. This is the one breaking change; the migration is a
  `getClusterMembers` call.
- `MarkerDescriptor`, `MarkerImage`, `MarkerAnchor` and `MarkerPoint` are no longer generated
  by nitrogen, because no spec references them. They are hand-written natively with the same
  names and fields, so the rendering code did not change. A spec that references them again
  would generate conflicting types.
- Handles are assigned by JS, so two collections cannot be merged natively; a map renders one
  collection at a time.
- Removing a handle from an index cell is a linear scan of that cell. Cells are small for
  ordinary datasets; a dataset whose bounds span the world but whose markers sit in one city
  degrades to O(cell size) per removal. A quadtree can replace the grid without changing the
  batch format.
- The C++ layer is still generated only. Moving the store, index and clustering into shared
  C++ remains an option for a later phase if profiling shows Kotlin or Swift compute as the
  limit; the batch format and the JS API would not change.

## Alternatives considered

- **HybridObject as a view prop vs. an attach method.** The prop was chosen: it survives
  provider remounts through the map's stored state, is declarative, and Nitro supports
  HybridObject-typed view props.
- **Strings inside the buffer.** UTF-8 in the `ArrayBuffer` would avoid a JSI string
  conversion per string, but every consumer would need its own decoder and the win is
  small, because strings are only sent for markers that changed.
- **Decoding on the JS thread.** Simpler ownership, but a 100,000-marker initial load would
  stall the JS thread for the decode. Copying the bytes costs microseconds and moves the
  decode to a thread nobody waits on.
- **Partial upsert records.** A field mask would shrink update batches, but fixed-size records
  keep the decoders branch-free and the common update (`updatePositions`) already has its
  own 24-byte record.
