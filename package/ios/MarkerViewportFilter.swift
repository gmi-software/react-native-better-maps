import MapKit

/// Selects a zoom-appropriate marker subset for large datasets.
enum MarkerViewportFilter {
  /// Precise viewport filter + spatial subsample over pre-narrowed candidates.
  ///
  /// The caller (spatial index) has already restricted `candidates` to cells
  /// near the region, so this runs over a small set and is safe to call off the
  /// main thread. Coordinates come from the store's flat arrays.
  static func displaySubset(
    candidates: [Int32],
    latitudes: [Double],
    longitudes: [Double],
    region: MKCoordinateRegion
  ) -> [Int32] {
    let maxCount = maxMarkers(for: region.span.latitudeDelta)
    let bounds = PaddedBounds(region: region, padding: 0.2)
    let visible = candidates.filter { handle in
      bounds.contains(latitude: latitudes[Int(handle)], longitude: longitudes[Int(handle)])
    }

    guard visible.count > maxCount else {
      return visible
    }

    return spatialSubsample(
      visible,
      latitudes: latitudes,
      longitudes: longitudes,
      maxCount: maxCount,
      region: region
    )
  }

  /// Picks at most one marker per geographic cell so subsampling stays visually even.
  private static func spatialSubsample(
    _ handles: [Int32],
    latitudes: [Double],
    longitudes: [Double],
    maxCount: Int,
    region: MKCoordinateRegion
  ) -> [Int32] {
    let columns = Int(ceil(sqrt(Double(maxCount))))
    let rows = Int(ceil(Double(maxCount) / Double(columns)))

    let latMin = region.center.latitude - region.span.latitudeDelta * 0.6
    let latMax = region.center.latitude + region.span.latitudeDelta * 0.6
    let lonMin = region.center.longitude - region.span.longitudeDelta * 0.6
    let lonMax = region.center.longitude + region.span.longitudeDelta * 0.6

    let latStep = max(1e-9, (latMax - latMin) / Double(rows))
    let lonStep = max(1e-9, (lonMax - lonMin) / Double(columns))

    var buckets: [Int: [Int32]] = [:]
    buckets.reserveCapacity(maxCount)

    for handle in handles {
      let index = Int(handle)
      let row = min(rows - 1, max(0, Int((latitudes[index] - latMin) / latStep)))
      let column = min(columns - 1, max(0, Int((longitudes[index] - lonMin) / lonStep)))
      buckets[row * columns + column, default: []].append(handle)
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

  private struct PaddedBounds {
    let minLat: Double
    let maxLat: Double
    let minLon: Double
    let maxLon: Double

    init(region: MKCoordinateRegion, padding: Double) {
      let latPadding = region.span.latitudeDelta * padding
      let lonPadding = region.span.longitudeDelta * padding
      minLat = region.center.latitude - region.span.latitudeDelta / 2 - latPadding
      maxLat = region.center.latitude + region.span.latitudeDelta / 2 + latPadding
      minLon = region.center.longitude - region.span.longitudeDelta / 2 - lonPadding
      maxLon = region.center.longitude + region.span.longitudeDelta / 2 + lonPadding
    }

    func contains(latitude: Double, longitude: Double) -> Bool {
      let lonInRegion: Bool
      if minLon <= maxLon {
        lonInRegion = longitude >= minLon && longitude <= maxLon
      } else {
        lonInRegion = longitude >= minLon || longitude <= maxLon
      }
      return latitude >= minLat && latitude <= maxLat && lonInRegion
    }
  }
}
