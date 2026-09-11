import MapKit

/// Selects a zoom-appropriate marker subset for large datasets.
enum MarkerViewportFilter {
  /// Precise viewport filter + spatial subsample over pre-narrowed candidates.
  ///
  /// The caller (spatial index) has already restricted `candidates` to cells
  /// near the region, so this runs over a small set and is safe to call off the
  /// main thread.
  static func displaySubset(
    candidates: [MarkerDescriptor],
    region: MKCoordinateRegion
  ) -> [MarkerDescriptor] {
    let maxCount = maxMarkers(for: region.span.latitudeDelta)
    let visible = candidates.filter { region.contains($0.coordinate, padding: 0.2) }

    guard visible.count > maxCount else {
      return visible
    }

    return spatialSubsample(visible, maxCount: maxCount, region: region)
  }

  /// Picks at most one marker per geographic cell so subsampling stays visually even.
  private static func spatialSubsample(
    _ markers: [MarkerDescriptor],
    maxCount: Int,
    region: MKCoordinateRegion
  ) -> [MarkerDescriptor] {
    let columns = Int(ceil(sqrt(Double(maxCount))))
    let rows = Int(ceil(Double(maxCount) / Double(columns)))

    let latMin = region.center.latitude - region.span.latitudeDelta * 0.6
    let latMax = region.center.latitude + region.span.latitudeDelta * 0.6
    let lonMin = region.center.longitude - region.span.longitudeDelta * 0.6
    let lonMax = region.center.longitude + region.span.longitudeDelta * 0.6

    let latStep = max(1e-9, (latMax - latMin) / Double(rows))
    let lonStep = max(1e-9, (lonMax - lonMin) / Double(columns))

    var buckets: [String: [MarkerDescriptor]] = [:]
    buckets.reserveCapacity(maxCount)

    for marker in markers {
      let row = min(rows - 1, max(0, Int((marker.coordinate.latitude - latMin) / latStep)))
      let column = min(columns - 1, max(0, Int((marker.coordinate.longitude - lonMin) / lonStep)))
      buckets["\(row)-\(column)", default: []].append(marker)
    }

    return buckets.values.map { cell in
      cell[cell.count / 2]
    }
  }

  private static func maxMarkers(for latitudeDelta: Double) -> Int {
    if latitudeDelta < 0.08 {
      return 2_000
    }
    if latitudeDelta < 0.5 {
      return 800
    }
    if latitudeDelta < 2.0 {
      return 350
    }
    return 200
  }
}

extension MKCoordinateRegion {
  fileprivate func contains(_ coordinate: Coordinate, padding: Double) -> Bool {
    let latPadding = span.latitudeDelta * padding
    let lonPadding = span.longitudeDelta * padding
    let minLat = center.latitude - span.latitudeDelta / 2 - latPadding
    let maxLat = center.latitude + span.latitudeDelta / 2 + latPadding
    let minLon = center.longitude - span.longitudeDelta / 2 - lonPadding
    let maxLon = center.longitude + span.longitudeDelta / 2 + lonPadding

    let lonInRegion: Bool
    if minLon <= maxLon {
      lonInRegion = coordinate.longitude >= minLon && coordinate.longitude <= maxLon
    } else {
      lonInRegion = coordinate.longitude >= minLon || coordinate.longitude <= maxLon
    }

    return coordinate.latitude >= minLat
      && coordinate.latitude <= maxLat
      && lonInRegion
  }
}
