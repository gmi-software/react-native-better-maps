import MapKit

/// Grid-based marker clustering computed in geographic space.
///
/// Runs over store handles and the store's flat coordinate arrays (no
/// `MKMapView` projection, no descriptor copies), so it is safe to call from a
/// background queue. Output is bounded by the number of grid cells that fit on
/// screen, keeping per-frame MapKit work small and constant.
enum MarkerClusterEngine {
  /// A single display element: an individual marker or a cluster badge.
  enum Element {
    case single(handle: Int32)
    case cluster(
      id: String,
      coordinate: CLLocationCoordinate2D,
      count: Int,
      memberHandles: [Int32],
      region: MKCoordinateRegion
    )
  }

  /// Target cluster cell size in points.
  static let defaultCellPoints: Double = 64

  /// Padding the spatial index applies around the visible region when it selects candidates.
  static let candidatePadding: Double = 0.2

  /// Rows and columns of cluster cells, inclusive.
  struct CellRange {
    let rowMin: Int
    let rowMax: Int
    let colMin: Int
    let colMax: Int

    func contains(_ key: Int64) -> Bool {
      let row = Int(key >> 32)
      let column = Int(Int32(truncatingIfNeeded: key))
      return row >= rowMin && row <= rowMax && column >= colMin && column <= colMax
    }
  }

  static func cellKey(row: Int, column: Int) -> Int64 {
    (Int64(row) << 32) | Int64(UInt32(truncatingIfNeeded: column))
  }

  private static func wrapsLongitude(in region: MKCoordinateRegion) -> Bool {
    region.span.longitudeDelta > 180
  }

  private static func normalizeLongitude(_ lon: Double, reference: Double) -> Double {
    var normalized = lon
    while normalized - reference > 180 {
      normalized -= 360
    }
    while normalized - reference < -180 {
      normalized += 360
    }
    return normalized
  }

  private static func wrapTo180(_ lon: Double) -> Double {
    var wrapped = lon
    while wrapped > 180 {
      wrapped -= 360
    }
    while wrapped < -180 {
      wrapped += 360
    }
    return wrapped
  }

  /// Snaps a cell size (degrees) to the nearest power of two so small zoom
  /// changes keep the same absolute grid.
  private static func quantize(_ value: Double) -> Double {
    guard value > 0, value.isFinite else {
      return 1
    }
    return pow(2, log2(value).rounded())
  }

  /// Approximate badge radius (points) per count — mirrors the annotation views
  /// so the overlap test matches what is actually drawn.
  private static func badgeRadius(for count: Int) -> Double {
    ClusterBadgeMetrics.badgeRadius(for: count)
  }

  /// Extra slack (points) so near-touching badges still merge.
  private static let mergeGap = ClusterBadgeMetrics.mergeGap

  struct Bucket {
    let row: Int
    let column: Int
    var count = 0
    var sumLat = 0.0
    var sumLon = 0.0
    var minLat = Double.greatestFiniteMagnitude
    var maxLat = -Double.greatestFiniteMagnitude
    var minLon = Double.greatestFiniteMagnitude
    var maxLon = -Double.greatestFiniteMagnitude
    var memberHandles: [Int32] = []

    init(row: Int, column: Int) {
      self.row = row
      self.column = column
    }

    /// Stable identity: the grid cell, which is anchored to geography.
    var id: String {
      "\(row):\(column)"
    }

    /// Adds one marker. Called through `Dictionary.subscript(_:default:)` so
    /// the bucket is mutated in place and `memberHandles` keeps a unique buffer.
    mutating func include(_ handle: Int32, lat: Double, lon: Double) {
      count += 1
      sumLat += lat
      sumLon += lon
      minLat = min(minLat, lat)
      maxLat = max(maxLat, lat)
      minLon = min(minLon, lon)
      maxLon = max(maxLon, lon)
      memberHandles.append(handle)
    }

    /// Folds another bucket's members in. The receiver keeps its own cell,
    /// so callers should seed groups with the dominant (largest) bucket.
    mutating func absorb(_ other: Bucket) {
      count += other.count
      sumLat += other.sumLat
      sumLon += other.sumLon
      minLat = min(minLat, other.minLat)
      maxLat = max(maxLat, other.maxLat)
      minLon = min(minLon, other.minLon)
      maxLon = max(maxLon, other.maxLon)
      memberHandles.append(contentsOf: other.memberHandles)
    }
  }

  static func clusters(
    candidates: [Int32],
    latitudes: [Double],
    longitudes: [Double],
    flags: [UInt8],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    cellPoints: Double = defaultCellPoints,
    cache: ClusterOctaveCache? = nil,
    generation: Int = 0
  ) -> [Element] {
    guard !candidates.isEmpty else {
      return []
    }

    var singles: [Element] = []
    var clusterableCandidates: [Int32] = []
    for handle in candidates {
      if flags[Int(handle)] & MarkerStore.Flag.clusterable == 0 {
        singles.append(.single(handle: handle))
      } else {
        clusterableCandidates.append(handle)
      }
    }

    guard !clusterableCandidates.isEmpty else {
      return singles
    }

    let clusterCellPoints = max(1, cellPoints)
    let cols = max(1, Int(Double(viewSize.width) / clusterCellPoints))
    let rows = max(1, Int(Double(viewSize.height) / clusterCellPoints))
    let wraps = wrapsLongitude(in: region)
    let referenceLon = region.center.longitude - region.span.longitudeDelta / 2
    // Quantize cell size and anchor the grid to absolute (0,0) coordinates so
    // cells stay fixed to geography while panning — clusters don't churn or
    // "swim", only re-forming when the zoom level crosses an octave.
    let cellLat = quantize(region.span.latitudeDelta / Double(rows))
    let cellLon = quantize(region.span.longitudeDelta / Double(cols))

    // Cells fully inside the padded candidate region can be kept for the next
    // refresh; the cache is off across the antimeridian, where cell keys depend
    // on the viewport's own longitude reference.
    let activeCache = wraps ? nil : cache
    activeCache?.begin(cellLat: cellLat, cellLon: cellLon, generation: generation)
    var buckets = activeCache?.takeBuckets() ?? [:]
    for handle in clusterableCandidates {
      let index = Int(handle)
      let lat = latitudes[index]
      let lon = wraps
        ? normalizeLongitude(longitudes[index], reference: referenceLon)
        : longitudes[index]
      let row = Int((lat / cellLat).rounded(.down))
      let col = Int((lon / cellLon).rounded(.down))
      let key = cellKey(row: row, column: col)
      if let activeCache, activeCache.isComputed(key) {
        continue
      }
      buckets[key, default: Bucket(row: row, column: col)].include(handle, lat: lat, lon: lon)
    }

    let inView = Array(buckets.values)
    if let activeCache {
      let latPad = region.span.latitudeDelta * candidatePadding
      let lonPad = region.span.longitudeDelta * candidatePadding
      let minLat = region.center.latitude - region.span.latitudeDelta / 2 - latPad
      let maxLat = region.center.latitude + region.span.latitudeDelta / 2 + latPad
      let minLon = region.center.longitude - region.span.longitudeDelta / 2 - lonPad
      let maxLon = region.center.longitude + region.span.longitudeDelta / 2 + lonPad
      activeCache.buckets = buckets
      activeCache.finish(CellRange(
        rowMin: Int((minLat / cellLat).rounded(.up)),
        rowMax: Int((maxLat / cellLat).rounded(.down)) - 1,
        colMin: Int((minLon / cellLon).rounded(.up)),
        colMax: Int((maxLon / cellLon).rounded(.down)) - 1
      ))
    }

    // Groups are built on copies: the seeds may live in the octave cache and
    // must not absorb their neighbours in place.
    let merged = mergeOverlapping(
      inView,
      region: region,
      wraps: wraps,
      viewSize: viewSize
    )

    var elements = singles
    elements.reserveCapacity(merged.count + singles.count)
    for bucket in merged {
      if bucket.count == 1, let handle = bucket.memberHandles.first {
        elements.append(.single(handle: handle))
      } else {
        elements.append(.cluster(
          id: bucket.id,
          coordinate: CLLocationCoordinate2D(
            latitude: bucket.sumLat / Double(bucket.count),
            longitude: bucket.sumLon / Double(bucket.count)
          ),
          count: bucket.count,
          memberHandles: bucket.memberHandles,
          region: expandedRegion(
            minLat: bucket.minLat,
            maxLat: bucket.maxLat,
            minLon: wrapTo180(bucket.minLon),
            maxLon: wrapTo180(bucket.maxLon)
          )
        ))
      }
    }
    return elements
  }

  /// Merges buckets whose badges would overlap on screen, so a zoomed-out view
  /// collapses neighbouring cells into one badge instead of stacking them.
  /// Uses union-find on screen-space centroid distance; groups are seeded by the
  /// largest bucket so the resulting cluster id is stable.
  private static func mergeOverlapping(
    _ buckets: [Bucket],
    region: MKCoordinateRegion,
    wraps: Bool,
    viewSize: CGSize
  ) -> [Bucket] {
    let n = buckets.count
    guard n > 1 else {
      return buckets
    }

    let width = Double(viewSize.width)
    let height = Double(viewSize.height)
    let centerLat = region.center.latitude
    let referenceLon = region.center.longitude - region.span.longitudeDelta / 2
    let spanLat = max(region.span.latitudeDelta, 1e-9)
    let spanLon = max(region.span.longitudeDelta, 1e-9)
    let centerLon = wraps
      ? normalizeLongitude(referenceLon + spanLon / 2, reference: referenceLon)
      : region.center.longitude

    var px = [Double](repeating: 0, count: n)
    var py = [Double](repeating: 0, count: n)
    for i in 0..<n {
      let bucket = buckets[i]
      let lat = bucket.sumLat / Double(bucket.count)
      let lon = wraps
        ? normalizeLongitude(bucket.sumLon / Double(bucket.count), reference: referenceLon)
        : bucket.sumLon / Double(bucket.count)
      px[i] = (lon - centerLon) / spanLon * width
      py[i] = (centerLat - lat) / spanLat * height
    }

    var parent = Array(0..<n)
    func find(_ value: Int) -> Int {
      var root = value
      while parent[root] != root {
        parent[root] = parent[parent[root]]
        root = parent[root]
      }
      return root
    }

    for i in 0..<n {
      let ri = badgeRadius(for: buckets[i].count)
      for j in (i + 1)..<n {
        let dx = px[i] - px[j]
        let dy = py[i] - py[j]
        let minDist = ri + badgeRadius(for: buckets[j].count) + mergeGap
        if dx * dx + dy * dy < minDist * minDist {
          let a = find(i)
          let b = find(j)
          if a != b {
            parent[b] = a
          }
        }
      }
    }

    var groups: [Int: Bucket] = [:]
    var order: [Int] = []
    for index in (0..<n).sorted(by: { buckets[$0].count > buckets[$1].count }) {
      let root = find(index)
      if groups[root] != nil {
        groups[root]?.absorb(buckets[index])
      } else {
        groups[root] = buckets[index]
        order.append(root)
      }
    }
    return order.compactMap { groups[$0] }
  }

  /// Region that snugly contains a cluster's members, padded so a tap-to-zoom
  /// reveals them with breathing room (and never zooms in absurdly far).
  private static func expandedRegion(
    minLat: Double,
    maxLat: Double,
    minLon: Double,
    maxLon: Double
  ) -> MKCoordinateRegion {
    let center = CLLocationCoordinate2D(
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2
    )
    let span = MKCoordinateSpan(
      latitudeDelta: max((maxLat - minLat) * 1.6, 0.01),
      longitudeDelta: max((maxLon - minLon) * 1.6, 0.01)
    )
    return MKCoordinateRegion(center: center, span: span)
  }
}

/// Identity of a displayed element across refreshes.
///
/// A single carries its id as well as its handle: JS reuses a freed handle for
/// the next new marker, and a new marker must not be mistaken for an update of
/// the one that used to own the handle.
enum MarkerRenderKey: Hashable {
  case single(handle: Int32, id: String)
  case cluster(id: String)
}

/// A display element with everything the renderer needs, materialized from the
/// store for the elements that will actually be shown.
enum MarkerRenderElement {
  case single(descriptor: MarkerDescriptor)
  case cluster(
    id: String,
    coordinate: CLLocationCoordinate2D,
    count: Int,
    memberHandles: [Int32],
    region: MKCoordinateRegion
  )

  func makeAnnotation(
    markerEnteringAnimation: OverlayEnteringAnimationDescriptor?,
    clusterEnteringAnimation: OverlayEnteringAnimationDescriptor?
  ) -> MKAnnotation {
    switch self {
    case let .single(descriptor):
      return MapMarkerAnnotation(
        descriptor: descriptor,
        enteringAnimation: OverlayEnteringAnimationResolver.resolve(
          descriptor.enteringAnimation,
          fallback: markerEnteringAnimation
        )
      )
    case let .cluster(id, coordinate, count, memberHandles, region):
      return MapClusterAnnotation(
        id: id,
        coordinate: coordinate,
        count: count,
        memberHandles: memberHandles,
        region: region,
        enteringAnimation: OverlayEnteringAnimationResolver.resolve(clusterEnteringAnimation)
      )
    }
  }
}

struct MarkerRenderEntry {
  let key: MarkerRenderKey
  let element: MarkerRenderElement
  let version: Int
}

struct MarkerRenderDiff {
  let removedKeys: Set<MarkerRenderKey>
  let added: [MarkerRenderEntry]
  let retained: [MarkerRenderEntry]
}

/// Drives one map's marker rendering from a `MarkerStore`: the synchronous
/// full diff for small datasets, and the coalesced background viewport pipeline
/// (index query → cluster or LOD filter → diff) for large or clustered ones.
final class MarkerRenderPipeline {
  private static let asyncThreshold = 500
  static let liveRefreshInterval: TimeInterval = 0.1

  /// The inputs of one refresh: what to show for a viewport, diffed against
  /// what is shown, and where to deliver the result.
  private struct RefreshParameters {
    let displayedVersions: [MarkerRenderKey: Int]
    let region: MKCoordinateRegion
    let viewSize: CGSize
    let apply: (MarkerRenderDiff) -> Void
  }

  /// One viewport query, cluster or filter pass, and diff, computed off the
  /// main thread against the store.
  private struct ViewportRefreshRequest {
    let generation: Int
    let store: MarkerStore
    let clustering: Bool
    let cache: ClusterOctaveCache
    let datasetGeneration: Int
    let parameters: RefreshParameters
  }

  /// Coalesces refresh requests between the main thread (producer) and the
  /// compute queue (consumer). At most one compute block is queued at a time; a
  /// request posted while one is queued replaces the pending request instead of
  /// adding another block, so a long gesture cannot build a backlog of stale
  /// work.
  private final class RefreshInbox {
    private let lock = NSLock()
    private var pending: ViewportRefreshRequest?
    private var isComputeQueued = false

    /// Stores `request` as the latest one. Returns true when the caller must
    /// enqueue a compute block, false when a queued block will pick it up.
    func post(_ request: ViewportRefreshRequest) -> Bool {
      lock.lock()
      defer { lock.unlock() }
      pending = request
      if isComputeQueued {
        return false
      }
      isComputeQueued = true
      return true
    }

    /// Hands the latest request to the compute block and frees the slot.
    func take() -> ViewportRefreshRequest? {
      lock.lock()
      defer { lock.unlock() }
      isComputeQueued = false
      let request = pending
      pending = nil
      return request
    }

    func discardPending() {
      lock.lock()
      pending = nil
      lock.unlock()
    }
  }

  private let clusterCellPoints: Double
  private(set) var store: MarkerStore?
  private var viewportRefreshWorkItem: DispatchWorkItem?
  /// Invalidates in-flight refresh results (viewport diffs).
  private var refreshGeneration = 0
  /// Bumped whenever the dataset or the clustering mode changes; keyed into the octave cache.
  private var datasetGeneration = 0
  private var clusterCache = ClusterOctaveCache()
  private var clusteringEnabled = false
  private let refreshInbox = RefreshInbox()
  private let computeQueue = DispatchQueue(
    label: "com.nitromaps.markerCompute",
    qos: .userInitiated
  )

  init(clusterCellPoints: Double = MarkerClusterEngine.defaultCellPoints) {
    self.clusterCellPoints = clusterCellPoints
  }

  var usesViewportPipeline: Bool {
    clusteringEnabled || (store?.markerCount ?? 0) > Self.asyncThreshold
  }

  func attach(store: MarkerStore?) {
    self.store = store
    invalidate()
    invalidateClusterCache()
  }

  func reset() {
    invalidate()
    invalidateClusterCache()
    store = nil
    clusteringEnabled = false
  }

  func setClusteringEnabled(_ enabled: Bool) -> Bool {
    guard clusteringEnabled != enabled else {
      return false
    }

    clusteringEnabled = enabled
    invalidateClusterCache()
    return true
  }

  /// Forgets cached cluster cells. The compute queue may still be inside a
  /// refresh that holds the old cache, so a fresh object replaces it.
  func invalidateClusterCache() {
    datasetGeneration += 1
    clusterCache = ClusterOctaveCache()
  }

  /// Recomputes what is shown for the current dataset: synchronously for small
  /// unclustered datasets, through the viewport pipeline otherwise.
  func reapply(
    displayedVersions: [MarkerRenderKey: Int],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    apply: @escaping (MarkerRenderDiff) -> Void
  ) {
    let parameters = RefreshParameters(
      displayedVersions: displayedVersions,
      region: region,
      viewSize: viewSize,
      apply: apply
    )
    if usesViewportPipeline {
      refreshNow(parameters)
      return
    }

    invalidate()
    let target: [MarkerRenderEntry] = store?.read { access in
      Self.materialize(access.aliveHandles().map { .single(handle: $0) }, access: access)
    } ?? []
    apply(Self.computeDiff(target: target, displayed: displayedVersions))
  }

  func scheduleViewportRefresh(
    displayedVersions: [MarkerRenderKey: Int],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    immediate: Bool = false,
    apply: @escaping (MarkerRenderDiff) -> Void
  ) {
    guard usesViewportPipeline else {
      return
    }

    viewportRefreshWorkItem?.cancel()
    refreshGeneration += 1
    let generation = refreshGeneration
    let work = DispatchWorkItem { [weak self] in
      guard let self, generation == self.refreshGeneration else {
        return
      }
      self.refreshNow(
        displayedVersions: displayedVersions,
        region: region,
        viewSize: viewSize,
        apply: apply
      )
    }
    viewportRefreshWorkItem = work

    if immediate {
      work.perform()
    } else {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.12, execute: work)
    }
  }

  func refreshNow(
    displayedVersions: [MarkerRenderKey: Int],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    apply: @escaping (MarkerRenderDiff) -> Void
  ) {
    guard usesViewportPipeline else {
      return
    }

    refreshNow(RefreshParameters(
      displayedVersions: displayedVersions,
      region: region,
      viewSize: viewSize,
      apply: apply
    ))
  }

  private func refreshNow(_ parameters: RefreshParameters) {
    guard let store else {
      return
    }

    refreshGeneration += 1
    let request = ViewportRefreshRequest(
      generation: refreshGeneration,
      store: store,
      clustering: clusteringEnabled,
      cache: clusterCache,
      datasetGeneration: datasetGeneration,
      parameters: parameters
    )
    guard refreshInbox.post(request) else {
      // A compute block is already queued and will pick this request up.
      return
    }

    let clusterCellPoints = self.clusterCellPoints
    computeQueue.async { [weak self] in
      guard let self, let request = self.refreshInbox.take() else {
        return
      }

      let diff = Self.computeViewportDiff(request, clusterCellPoints: clusterCellPoints)
      DispatchQueue.main.async { [weak self] in
        guard let self, request.generation == self.refreshGeneration else {
          return
        }
        request.parameters.apply(diff)
      }
    }
  }

  private func invalidate() {
    viewportRefreshWorkItem?.cancel()
    viewportRefreshWorkItem = nil
    refreshGeneration += 1
    refreshInbox.discardPending()
  }

  private static func computeViewportDiff(
    _ request: ViewportRefreshRequest,
    clusterCellPoints: Double
  ) -> MarkerRenderDiff {
    let signpost = MapTrace.begin("computeViewportDiff")
    defer { MapTrace.end("computeViewportDiff", signpost) }
    let parameters = request.parameters
    let store = request.store

    // Snapshot the coordinate arrays under the lock (copy-on-write, O(1)) and
    // run the geometry outside it.
    let (candidates, latitudes, longitudes, flags) = store.read { access in
      (
        access.index.candidates(in: parameters.region, padding: MarkerClusterEngine.candidatePadding),
        access.latitudes,
        access.longitudes,
        access.flags
      )
    }

    let elements: [MarkerClusterEngine.Element]
    if request.clustering {
      elements = MarkerClusterEngine.clusters(
        candidates: candidates,
        latitudes: latitudes,
        longitudes: longitudes,
        flags: flags,
        region: parameters.region,
        viewSize: parameters.viewSize,
        cellPoints: clusterCellPoints,
        cache: request.cache,
        generation: request.datasetGeneration
      )
    } else {
      elements = MarkerViewportFilter
        .displaySubset(
          candidates: candidates,
          latitudes: latitudes,
          longitudes: longitudes,
          region: parameters.region
        )
        .map { .single(handle: $0) }
    }

    let target = store.read { access in materialize(elements, access: access) }
    return computeDiff(target: target, displayed: parameters.displayedVersions)
  }

  /// Turns handles into render entries with their descriptors and versions.
  /// A handle removed between the query and this call is dropped.
  private static func materialize(
    _ elements: [MarkerClusterEngine.Element],
    access: MarkerStoreAccess
  ) -> [MarkerRenderEntry] {
    var entries: [MarkerRenderEntry] = []
    entries.reserveCapacity(elements.count)
    for element in elements {
      switch element {
      case let .single(handle):
        let index = Int(handle)
        guard access.isAlive(index), let descriptor = access.descriptors[index] else {
          continue
        }
        entries.append(MarkerRenderEntry(
          key: .single(handle: handle, id: descriptor.id),
          element: .single(descriptor: descriptor),
          version: access.versions[index]
        ))
      case let .cluster(id, coordinate, count, memberHandles, region):
        var hasher = Hasher()
        hasher.combine(id)
        hasher.combine(coordinate.latitude)
        hasher.combine(coordinate.longitude)
        hasher.combine(count)
        hasher.combine(region.center.latitude)
        hasher.combine(region.center.longitude)
        hasher.combine(region.span.latitudeDelta)
        hasher.combine(region.span.longitudeDelta)
        entries.append(MarkerRenderEntry(
          key: .cluster(id: id),
          element: .cluster(
            id: id,
            coordinate: coordinate,
            count: count,
            memberHandles: memberHandles,
            region: region
          ),
          version: hasher.finalize()
        ))
      }
    }
    return entries
  }

  static func computeDiff(
    target: [MarkerRenderEntry],
    displayed: [MarkerRenderKey: Int]
  ) -> MarkerRenderDiff {
    var nextKeys = Set<MarkerRenderKey>()
    nextKeys.reserveCapacity(target.count)
    var added: [MarkerRenderEntry] = []
    var retained: [MarkerRenderEntry] = []

    for entry in target {
      guard nextKeys.insert(entry.key).inserted else {
        continue
      }
      if let displayedVersion = displayed[entry.key] {
        if displayedVersion != entry.version {
          retained.append(entry)
        }
      } else {
        added.append(entry)
      }
    }

    return MarkerRenderDiff(
      removedKeys: Set(displayed.keys).subtracting(nextKeys),
      added: added,
      retained: retained
    )
  }
}
