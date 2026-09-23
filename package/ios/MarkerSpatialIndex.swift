import MapKit

/// Uniform grid spatial index over a marker dataset.
///
/// Built once per dataset so viewport queries cost O(cells in view + markers in
/// those cells) instead of O(all markers). Immutable after init, so instances
/// are safe to query from a background queue.
///
/// Every coordinate must be placeable: cells come from `Int(_:)`, which traps on
/// NaN and infinity. `MarkerRenderPipeline.setMarkers` drops those.
final class MarkerSpatialIndex {
  let count: Int
  private let cellsPerSide: Int
  private let minLat: Double
  private let minLon: Double
  private let latStep: Double
  private let lonStep: Double
  private var cells: [[MarkerDescriptor]]

  init(markers: [MarkerDescriptor], cellsPerSide: Int = 96) {
    count = markers.count
    let side = max(1, cellsPerSide)
    self.cellsPerSide = side

    var minLatV = Double.greatestFiniteMagnitude
    var maxLatV = -Double.greatestFiniteMagnitude
    var minLonV = Double.greatestFiniteMagnitude
    var maxLonV = -Double.greatestFiniteMagnitude

    for marker in markers {
      let lat = marker.coordinate.latitude
      let lon = marker.coordinate.longitude
      minLatV = min(minLatV, lat)
      maxLatV = max(maxLatV, lat)
      minLonV = min(minLonV, lon)
      maxLonV = max(maxLonV, lon)
    }

    if markers.isEmpty {
      minLatV = 0
      maxLatV = 0
      minLonV = 0
      maxLonV = 0
    }

    minLat = minLatV
    minLon = minLonV
    latStep = max(1e-9, (maxLatV - minLatV) / Double(side))
    lonStep = max(1e-9, (maxLonV - minLonV) / Double(side))
    cells = Array(repeating: [], count: side * side)

    for marker in markers {
      let index = cellIndex(
        lat: marker.coordinate.latitude,
        lon: marker.coordinate.longitude
      )
      cells[index].append(marker)
    }
  }

  /// Markers whose grid cells overlap the padded region.
  func candidates(in region: MKCoordinateRegion, padding: Double = 0.2) -> [MarkerDescriptor] {
    guard count > 0 else {
      return []
    }

    let latPad = region.span.latitudeDelta * padding
    let lonPad = region.span.longitudeDelta * padding
    let minLatQ = region.center.latitude - region.span.latitudeDelta / 2 - latPad
    let maxLatQ = region.center.latitude + region.span.latitudeDelta / 2 + latPad
    let minLonQ = region.center.longitude - region.span.longitudeDelta / 2 - lonPad
    let maxLonQ = region.center.longitude + region.span.longitudeDelta / 2 + lonPad

    let rowStart = clampedRow(minLatQ)
    let rowEnd = clampedRow(maxLatQ)

    var result: [MarkerDescriptor] = []
    var row = rowStart
    while row <= rowEnd {
      let base = row * cellsPerSide
      for column in longitudeColumnRange(minLon: minLonQ, maxLon: maxLonQ) {
        result.append(contentsOf: cells[base + column])
      }
      row += 1
    }
    return result
  }

  private func longitudeColumnRange(minLon: Double, maxLon: Double) -> [Int] {
    if maxLon - minLon >= 360.0 {
      return Array(0..<cellsPerSide)
    }

    let wrappedMin = wrapLongitude(minLon)
    let wrappedMax = wrapLongitude(maxLon)
    if wrappedMin <= wrappedMax && maxLon <= 180.0 && minLon >= -180.0 {
      let colStart = clampedColumn(wrappedMin)
      let colEnd = clampedColumn(wrappedMax)
      return Array(colStart...colEnd)
    }

    let firstRange = clampedColumn(wrappedMin)...cellsPerSide - 1
    let secondRange = 0...clampedColumn(wrappedMax)
    return Array(firstRange) + Array(secondRange)
  }

  private func wrapLongitude(_ lon: Double) -> Double {
    var wrapped = lon
    while wrapped > 180.0 { wrapped -= 360.0 }
    while wrapped < -180.0 { wrapped += 360.0 }
    return wrapped
  }

  private func cellIndex(lat: Double, lon: Double) -> Int {
    clampedRow(lat) * cellsPerSide + clampedColumn(lon)
  }

  private func clampedRow(_ lat: Double) -> Int {
    min(cellsPerSide - 1, max(0, Int((lat - minLat) / latStep)))
  }

  private func clampedColumn(_ lon: Double) -> Int {
    min(cellsPerSide - 1, max(0, Int((lon - minLon) / lonStep)))
  }
}
