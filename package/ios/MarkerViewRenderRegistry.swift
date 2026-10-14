import MapKit

/// Splits the marker pipeline's output between the SDK and live `MarkerView`
/// hosts. Live elements are taken out of every diff before it reaches the SDK,
/// and JS hears which live hosts to mount whenever that set changes.
///
/// `MarkerViewRenderRegistry.kt` is the Android counterpart; change the two together.
final class MarkerViewRenderRegistry {
  /// Whether clusters are live hosts (`renderCluster`) rather than SDK badges.
  private(set) var customClusters = false

  var onChange: ((NativeMarkerViewRenderState) -> Void)? {
    didSet { publish() }
  }

  private var entries: [String: MarkerRenderEntry] = [:]

  /// `sdkVersions` plus the live elements, which count as displayed too: the
  /// pipeline diffs against both.
  func displayedVersions(merging sdkVersions: [String: Int]) -> [String: Int] {
    guard !entries.isEmpty else {
      return sdkVersions
    }
    var versions = sdkVersions
    for (key, entry) in entries {
      versions[key] = entry.version
    }
    return versions
  }

  /// Returns whether the setting changed; the caller then redraws every marker.
  func setCustomClusters(_ enabled: Bool) -> Bool {
    guard customClusters != enabled else {
      return false
    }
    customClusters = enabled
    return true
  }

  func reset() {
    guard !entries.isEmpty else {
      return
    }
    entries.removeAll()
    publish()
  }

  /// Takes the live elements out of `diff` and returns what the SDK still has to do.
  func consume(_ diff: MarkerRenderDiff) -> MarkerRenderDiff {
    var removed = diff.removedKeys
    var added: [MarkerRenderEntry] = []
    var retained: [MarkerRenderEntry] = []
    var changed = false

    for key in diff.removedKeys where entries.removeValue(forKey: key) != nil {
      changed = true
    }

    func route(_ entry: MarkerRenderEntry, isNew: Bool) {
      if isLive(entry.element) {
        let previous = entries.updateValue(entry, forKey: entry.key)
        if previous == nil {
          // Retained but not live until now: the SDK drew it, so it goes.
          if !isNew {
            removed.insert(entry.key)
          }
          changed = true
        } else if case .cluster = entry.element {
          // A cluster's position, count and members come from here; a live
          // marker's own props come from JS, which need not hear about them.
          changed = true
        }
      } else if entries.removeValue(forKey: entry.key) != nil {
        // Live until now, so the SDK has nothing to update: it adds it.
        added.append(entry)
        changed = true
      } else if isNew {
        added.append(entry)
      } else {
        retained.append(entry)
      }
    }

    for entry in diff.added {
      route(entry, isNew: true)
    }
    for entry in diff.retained {
      route(entry, isNew: false)
    }

    if changed {
      publish()
    }
    return MarkerRenderDiff(removedKeys: removed, added: added, retained: retained)
  }

  private func isLive(_ element: MarkerClusterEngine.Element) -> Bool {
    switch element {
    case .single(let descriptor):
      return descriptor.liveView == true
    case .cluster:
      return customClusters
    }
  }

  private func publish() {
    guard let onChange else {
      return
    }

    var markerIds: [String] = []
    var clusters: [NativeMarkerViewCluster] = []
    for key in entries.keys.sorted() {
      switch entries[key]?.element {
      case .single(let descriptor):
        markerIds.append(descriptor.id)
      case .cluster(_, let coordinate, _, let memberIds, _):
        clusters.append(
          NativeMarkerViewCluster(
            id: key,
            coordinate: Coordinate(
              latitude: coordinate.latitude,
              longitude: Self.wrappedLongitude(coordinate.longitude)
            ),
            markerIds: memberIds.sorted()
          )
        )
      case .none:
        continue
      }
    }
    onChange(NativeMarkerViewRenderState(markerIds: markerIds, clusters: clusters))
  }

  /// Cluster centers across the antimeridian can fall outside -180...180.
  private static func wrappedLongitude(_ longitude: Double) -> Double {
    let wrapped = (longitude + 180).truncatingRemainder(dividingBy: 360)
    return (wrapped < 0 ? wrapped + 360 : wrapped) - 180
  }
}
