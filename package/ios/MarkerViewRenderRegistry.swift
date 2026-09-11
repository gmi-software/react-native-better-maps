import MapKit

/// Splits one native clustering result between SDK objects and live Fabric hosts.
final class MarkerViewRenderRegistry {
  var customClusters = false
  var onChange: ((NativeMarkerViewRenderState) -> Void)? {
    didSet { publish() }
  }
  private var entries: [String: MarkerRenderEntry] = [:]

  var versions: [String: Int] { entries.mapValues { $0.version } }

  func reset() {
    guard !entries.isEmpty else { return }
    entries.removeAll()
    publish()
  }

  func consume(_ diff: MarkerRenderDiff) -> MarkerRenderDiff {
    var removed = diff.removedKeys
    var added: [MarkerRenderEntry] = []
    var retained: [MarkerRenderEntry] = []
    var changed = false
    for key in diff.removedKeys {
      if entries.removeValue(forKey: key) != nil { changed = true }
    }
    func consumeEntry(_ entry: MarkerRenderEntry, isNew: Bool) {
      let live: Bool
      switch entry.element {
      case let .single(descriptor): live = descriptor.customViewId != nil
      case .cluster: live = customClusters
      }
      if live {
        entries[entry.key] = entry
        removed.insert(entry.key)
        changed = true
      } else if entries.removeValue(forKey: entry.key) != nil {
        added.append(entry)
        changed = true
      } else if isNew {
        added.append(entry)
      } else {
        retained.append(entry)
      }
    }
    for entry in diff.added { consumeEntry(entry, isNew: true) }
    for entry in diff.retained { consumeEntry(entry, isNew: false) }
    if changed { publish() }
    return MarkerRenderDiff(removedKeys: removed, added: added, retained: retained)
  }

  private func publish() {
    guard let onChange else { return }
    var ids: [String] = []
    var clusters: [NativeMarkerViewCluster] = []
    for key in entries.keys.sorted() {
      guard let entry = entries[key] else { continue }
      switch entry.element {
      case let .single(descriptor):
        if let id = descriptor.customViewId { ids.append(id) }
      case let .cluster(_, coordinate, _, memberIds, region):
        let longitude = ((coordinate.longitude + 180).truncatingRemainder(dividingBy: 360) + 360)
          .truncatingRemainder(dividingBy: 360) - 180
        clusters.append(NativeMarkerViewCluster(
          id: key,
          coordinate: Coordinate(latitude: coordinate.latitude, longitude: longitude),
          markerIds: memberIds.sorted(),
          region: region.toRegion()
        ))
      }
    }
    onChange(NativeMarkerViewRenderState(markerViewIds: ids, clusters: clusters))
  }
}
