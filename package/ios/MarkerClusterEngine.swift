import MapKit

/// Grid-based marker clustering computed in geographic space.
///
/// Runs entirely off descriptor data (no `MKMapView` projection), so it is safe
/// to call from a background queue. Output is bounded by the number of grid
/// cells that fit on screen, keeping per-frame MapKit work small and constant.
enum MarkerClusterEngine {
  /// A single display element: an individual marker or a cluster badge.
  enum Element {
    case single(MarkerDescriptor)
    case cluster(
      key: String,
      coordinate: CLLocationCoordinate2D,
      count: Int,
      memberIds: [String],
      region: MKCoordinateRegion
    )

    /// Stable identity for diffing. Count changes update the retained badge
    /// instead of removing and re-adding the native marker during gestures.
    var diffKey: String {
      switch self {
      case let .single(descriptor):
        return "s:" + descriptor.id
      case let .cluster(key, _, _, _, _):
        return "c:" + key
      }
    }

    var renderVersion: Int {
      switch self {
      case let .single(descriptor):
        return descriptor.displayedIdentityVersion()
      case let .cluster(key, coordinate, count, memberIds, region):
        var hasher = Hasher()
        hasher.combine("cluster")
        hasher.combine(key)
        hasher.combine(coordinate.latitude)
        hasher.combine(coordinate.longitude)
        hasher.combine(count)
        for id in memberIds.sorted() {
          hasher.combine(id)
        }
        hasher.combine(region.center.latitude)
        hasher.combine(region.center.longitude)
        hasher.combine(region.span.latitudeDelta)
        hasher.combine(region.span.longitudeDelta)
        return hasher.finalize()
      }
    }

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
      case let .cluster(key, coordinate, count, memberIds, region):
        return MapClusterAnnotation(
          id: key,
          coordinate: coordinate,
          count: count,
          memberIds: memberIds,
          region: region,
          enteringAnimation: OverlayEnteringAnimationResolver.resolve(clusterEnteringAnimation)
        )
      }
    }
  }

  /// Target cluster cell size in points.
  static let defaultCellPoints: Double = 64

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

  private struct Bucket {
    var key = ""
    var count = 0
    var sumLat = 0.0
    var sumLon = 0.0
    var minLat = Double.greatestFiniteMagnitude
    var maxLat = -Double.greatestFiniteMagnitude
    var minLon = Double.greatestFiniteMagnitude
    var maxLon = -Double.greatestFiniteMagnitude
    var memberIds: [String] = []
    var first: MarkerDescriptor?

    /// Folds another bucket's members in. The receiver keeps its own key/first,
    /// so callers should seed groups with the dominant (largest) bucket.
    mutating func absorb(_ other: Bucket) {
      count += other.count
      sumLat += other.sumLat
      sumLon += other.sumLon
      minLat = min(minLat, other.minLat)
      maxLat = max(maxLat, other.maxLat)
      minLon = min(minLon, other.minLon)
      maxLon = max(maxLon, other.maxLon)
      memberIds.append(contentsOf: other.memberIds)
    }
  }

  static func clusters(
    candidates: [MarkerDescriptor],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    cellPoints: Double = defaultCellPoints
  ) -> [Element] {
    guard !candidates.isEmpty else {
      return []
    }

    var singles: [Element] = []
    var clusterableCandidates: [MarkerDescriptor] = []
    for descriptor in candidates {
      if descriptor.clusterable == false {
        singles.append(.single(descriptor))
      } else {
        clusterableCandidates.append(descriptor)
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

    var buckets: [String: Bucket] = [:]
    for descriptor in clusterableCandidates {
      let lat = descriptor.coordinate.latitude
      let lon = wraps
        ? normalizeLongitude(descriptor.coordinate.longitude, reference: referenceLon)
        : descriptor.coordinate.longitude
      let row = Int((lat / cellLat).rounded(.down))
      let col = Int((lon / cellLon).rounded(.down))
      let key = "\(row):\(col)"

      var bucket = buckets[key] ?? Bucket()
      bucket.key = key
      bucket.count += 1
      bucket.sumLat += lat
      bucket.sumLon += lon
      bucket.minLat = min(bucket.minLat, lat)
      bucket.maxLat = max(bucket.maxLat, lat)
      bucket.minLon = min(bucket.minLon, lon)
      bucket.maxLon = max(bucket.maxLon, lon)
      if bucket.first == nil {
        bucket.first = descriptor
      }
      bucket.memberIds.append(descriptor.id)
      buckets[key] = bucket
    }

    let merged = mergeOverlapping(
      Array(buckets.values),
      region: region,
      wraps: wraps,
      viewSize: viewSize
    )

    var elements = singles
    elements.reserveCapacity(merged.count + singles.count)
    for bucket in merged {
      if bucket.count == 1, let descriptor = bucket.first {
        elements.append(.single(descriptor))
      } else {
        elements.append(.cluster(
          key: bucket.key,
          coordinate: CLLocationCoordinate2D(
            latitude: bucket.sumLat / Double(bucket.count),
            longitude: bucket.sumLon / Double(bucket.count)
          ),
          count: bucket.count,
          memberIds: bucket.memberIds,
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
  /// largest bucket so the resulting cluster key is stable.
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

struct MarkerRenderEntry {
  let key: String
  let element: MarkerClusterEngine.Element
  let version: Int
}

struct MarkerRenderDiff {
  let removedKeys: Set<String>
  let added: [MarkerRenderEntry]
  let retained: [MarkerRenderEntry]
}

final class MarkerRenderPipeline {
  private static let asyncThreshold = 500
  static let liveRefreshInterval: TimeInterval = 0.1

  private let clusterCellPoints: Double
  private var allMarkerDescriptors: [MarkerDescriptor] = []
  private var spatialIndex: MarkerSpatialIndex?
  private var viewportRefreshWorkItem: DispatchWorkItem?
  private var markersFingerprint = 0
  private var refreshGeneration = 0
  private var clusteringEnabled = false
  private let computeQueue = DispatchQueue(
    label: "com.nitromaps.markerCompute",
    qos: .userInitiated
  )

  init(clusterCellPoints: Double = MarkerClusterEngine.defaultCellPoints) {
    self.clusterCellPoints = clusterCellPoints
  }

  var usesViewportPipeline: Bool {
    clusteringEnabled || allMarkerDescriptors.count > Self.asyncThreshold
  }

  func reset() {
    viewportRefreshWorkItem?.cancel()
    viewportRefreshWorkItem = nil
    refreshGeneration += 1
    allMarkerDescriptors.removeAll()
    spatialIndex = nil
    markersFingerprint = 0
    clusteringEnabled = false
  }

  func setClusteringEnabled(_ enabled: Bool) -> Bool {
    guard clusteringEnabled != enabled else {
      return false
    }

    clusteringEnabled = enabled
    return true
  }

  func setMarkers(_ descriptors: [MarkerDescriptor]?) -> Bool {
    let next = descriptors ?? []
    let fingerprint = next.markersFingerprint()
    guard fingerprint != markersFingerprint else {
      return false
    }

    markersFingerprint = fingerprint
    allMarkerDescriptors = next
    spatialIndex = nil
    return true
  }

  func reapply(
    displayedVersions: [String: Int],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    apply: @escaping (MarkerRenderDiff) -> Void
  ) {
    if usesViewportPipeline {
      rebuildIndexAndRefresh(
        displayedVersions: displayedVersions,
        region: region,
        viewSize: viewSize,
        apply: apply
      )
    } else {
      viewportRefreshWorkItem?.cancel()
      viewportRefreshWorkItem = nil
      refreshGeneration += 1
      apply(Self.computeDiff(
        target: allMarkerDescriptors.map { .single($0) },
        displayed: displayedVersions
      ))
    }
  }

  func scheduleViewportRefresh(
    displayedVersions: [String: Int],
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
    displayedVersions: [String: Int],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    apply: @escaping (MarkerRenderDiff) -> Void
  ) {
    guard usesViewportPipeline else {
      return
    }

    guard let index = spatialIndex else {
      rebuildIndexAndRefresh(
        displayedVersions: displayedVersions,
        region: region,
        viewSize: viewSize,
        apply: apply
      )
      return
    }

    let clustering = clusteringEnabled
    refreshGeneration += 1
    let generation = refreshGeneration
    let clusterCellPoints = self.clusterCellPoints

    computeQueue.async { [weak self] in
      let candidates = index.candidates(in: region)
      let elements: [MarkerClusterEngine.Element]
      if clustering {
        elements = MarkerClusterEngine.clusters(
          candidates: candidates,
          region: region,
          viewSize: viewSize,
          cellPoints: clusterCellPoints
        )
      } else {
        elements = MarkerViewportFilter
          .displaySubset(candidates: candidates, region: region)
          .map { .single($0) }
      }

      let diff = Self.computeDiff(target: elements, displayed: displayedVersions)
      DispatchQueue.main.async {
        guard let self, generation == self.refreshGeneration else {
          return
        }
        apply(diff)
      }
    }
  }

  private func rebuildIndexAndRefresh(
    displayedVersions: [String: Int],
    region: MKCoordinateRegion,
    viewSize: CGSize,
    apply: @escaping (MarkerRenderDiff) -> Void
  ) {
    let descriptors = allMarkerDescriptors
    refreshGeneration += 1
    let generation = refreshGeneration

    computeQueue.async { [weak self] in
      let index = MarkerSpatialIndex(markers: descriptors)
      DispatchQueue.main.async {
        guard let self, generation == self.refreshGeneration else {
          return
        }
        self.spatialIndex = index
        self.refreshNow(
          displayedVersions: displayedVersions,
          region: region,
          viewSize: viewSize,
          apply: apply
        )
      }
    }
  }

  private static func computeDiff(
    target: [MarkerClusterEngine.Element],
    displayed: [String: Int]
  ) -> MarkerRenderDiff {
    var nextKeys = Set<String>()
    nextKeys.reserveCapacity(target.count)
    var added: [MarkerRenderEntry] = []
    var retained: [MarkerRenderEntry] = []

    for element in target {
      let key = element.diffKey
      guard nextKeys.insert(key).inserted else {
        continue
      }
      let version = element.renderVersion
      if let displayedVersion = displayed[key] {
        if displayedVersion != version {
          retained.append(MarkerRenderEntry(key: key, element: element, version: version))
        }
      } else {
        added.append(MarkerRenderEntry(key: key, element: element, version: version))
      }
    }

    return MarkerRenderDiff(
      removedKeys: Set(displayed.keys).subtracting(nextKeys),
      added: added,
      retained: retained
    )
  }
}
