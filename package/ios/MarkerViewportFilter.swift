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
    // A window that leaves [-180, 180] holds markers whose longitude has
    // wrapped to the other sign; measure their offset through the antimeridian.
    let crossesAntimeridian = lonMin < -180 || lonMax > 180

    let latStep = max(1e-9, (latMax - latMin) / Double(rows))
    let lonStep = max(1e-9, (lonMax - lonMin) / Double(columns))

    var buckets: [Int: [Int32]] = [:]
    buckets.reserveCapacity(maxCount)

    for handle in handles {
      let index = Int(handle)
      let row = min(rows - 1, max(0, Int((latitudes[index] - latMin) / latStep)))
      var lonOffset = longitudes[index] - lonMin
      if crossesAntimeridian {
        if lonOffset < 0 {
          lonOffset += 360
        } else if lonOffset >= 360 {
          lonOffset -= 360
        }
      }
      let column = min(columns - 1, max(0, Int(lonOffset / lonStep)))
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

  /// The region grown by `padding` on each side, with longitudes wrapped into
  /// [-180, 180]: a region across the antimeridian ends up with `minLon` east
  /// of `maxLon`, and `contains` reads that as the two-piece range it is.
  private struct PaddedBounds {
    let minLat: Double
    let maxLat: Double
    let minLon: Double
    let maxLon: Double
    let allLongitudes: Bool

    init(region: MKCoordinateRegion, padding: Double) {
      let latPadding = region.span.latitudeDelta * padding
      let lonPadding = region.span.longitudeDelta * padding
      minLat = region.center.latitude - region.span.latitudeDelta / 2 - latPadding
      maxLat = region.center.latitude + region.span.latitudeDelta / 2 + latPadding
      let paddedSpan = region.span.longitudeDelta + lonPadding * 2
      allLongitudes = paddedSpan >= 360
      minLon = Self.wrap(region.center.longitude - region.span.longitudeDelta / 2 - lonPadding)
      maxLon = Self.wrap(region.center.longitude + region.span.longitudeDelta / 2 + lonPadding)
    }

    func contains(latitude: Double, longitude: Double) -> Bool {
      let lonInRegion: Bool
      if allLongitudes {
        lonInRegion = true
      } else if minLon <= maxLon {
        lonInRegion = longitude >= minLon && longitude <= maxLon
      } else {
        lonInRegion = longitude >= minLon || longitude <= maxLon
      }
      return latitude >= minLat && latitude <= maxLat && lonInRegion
    }

    private static func wrap(_ longitude: Double) -> Double {
      var wrapped = longitude
      while wrapped > 180 {
        wrapped -= 360
      }
      while wrapped < -180 {
        wrapped += 360
      }
      return wrapped
    }
  }
}
