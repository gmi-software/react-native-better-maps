import MapKit

/// Uniform grid spatial index over marker handles.
///
/// Cells hold handles, not descriptors, and the grid is updated in place as
/// markers are inserted, moved and removed, so a moving marker costs one cell
/// swap instead of a rebuild. The grid bounds are computed over the dataset
/// with a margin; a marker that lands outside them flags a rebuild, which the
/// store runs once at the end of the batch that caused it.
///
/// Not thread-safe on its own: the owning `MarkerStore` serializes access.
final class MarkerSpatialIndex {
  private let cellsPerSide: Int
  private var minLat = 0.0
  private var maxLat = 0.0
  private var minLon = 0.0
  private var maxLon = 0.0
  private var latStep = 1.0
  private var lonStep = 1.0
  private var hasBounds = false
  private var needsRebuild = false
  private var cells: [[Int32]]
  /// Cell index per handle, -1 when the handle is not indexed.
  private var cellOf: [Int32] = []
  private(set) var count = 0

  init(cellsPerSide: Int = 96) {
    let side = max(1, cellsPerSide)
    self.cellsPerSide = side
    cells = Array(repeating: [], count: side * side)
  }

  func insert(_ handle: Int, latitude: Double, longitude: Double) {
    ensureCapacity(handle)
    guard cellOf[handle] < 0 else {
      move(handle, latitude: latitude, longitude: longitude)
      return
    }

    count += 1
    if !hasBounds || !contains(latitude: latitude, longitude: longitude) {
      needsRebuild = true
    }
    let cell = clampedCellIndex(latitude: latitude, longitude: longitude)
    cells[cell].append(Int32(handle))
    cellOf[handle] = Int32(cell)
  }

  func move(_ handle: Int, latitude: Double, longitude: Double) {
    guard handle < cellOf.count, cellOf[handle] >= 0 else {
      insert(handle, latitude: latitude, longitude: longitude)
      return
    }

    if !contains(latitude: latitude, longitude: longitude) {
      needsRebuild = true
    }
    let current = Int(cellOf[handle])
    let next = clampedCellIndex(latitude: latitude, longitude: longitude)
    guard next != current else {
      return
    }
    removeFromCell(handle, cell: current)
    cells[next].append(Int32(handle))
    cellOf[handle] = Int32(next)
  }

  func remove(_ handle: Int) {
    guard handle < cellOf.count, cellOf[handle] >= 0 else {
      return
    }
    removeFromCell(handle, cell: Int(cellOf[handle]))
    cellOf[handle] = -1
    count -= 1
  }

  func removeAll() {
    for index in cells.indices {
      cells[index].removeAll(keepingCapacity: false)
    }
    cellOf.removeAll()
    count = 0
    hasBounds = false
    needsRebuild = false
  }

  /// Recomputes the grid over every live marker if one fell outside the
  /// current bounds. Called once per applied batch, before any query.
  func rebuildIfNeeded(latitudes: [Double], longitudes: [Double], flags: [UInt8]) {
    guard needsRebuild else {
      return
    }
    needsRebuild = false

    var minLatV = Double.greatestFiniteMagnitude
    var maxLatV = -Double.greatestFiniteMagnitude
    var minLonV = Double.greatestFiniteMagnitude
    var maxLonV = -Double.greatestFiniteMagnitude
    var alive = 0
    for handle in 0..<flags.count where flags[handle] & MarkerStore.Flag.alive != 0 {
      alive += 1
      minLatV = min(minLatV, latitudes[handle])
      maxLatV = max(maxLatV, latitudes[handle])
      minLonV = min(minLonV, longitudes[handle])
      maxLonV = max(maxLonV, longitudes[handle])
    }

    for index in cells.indices {
      cells[index].removeAll(keepingCapacity: true)
    }
    guard alive > 0 else {
      hasBounds = false
      for handle in cellOf.indices {
        cellOf[handle] = -1
      }
      count = 0
      return
    }

    // A margin keeps ordinary movement inside the grid; only a marker that
    // leaves the dataset's neighbourhood triggers the next rebuild.
    let latPad = max((maxLatV - minLatV) * 0.15, 1e-6)
    let lonPad = max((maxLonV - minLonV) * 0.15, 1e-6)
    minLat = minLatV - latPad
    maxLat = maxLatV + latPad
    minLon = minLonV - lonPad
    maxLon = maxLonV + lonPad
    latStep = max(1e-9, (maxLat - minLat) / Double(cellsPerSide))
    lonStep = max(1e-9, (maxLon - minLon) / Double(cellsPerSide))
    hasBounds = true

    ensureCapacity(flags.count - 1)
    for handle in 0..<flags.count {
      if flags[handle] & MarkerStore.Flag.alive != 0 {
        let cell = clampedCellIndex(latitude: latitudes[handle], longitude: longitudes[handle])
        cells[cell].append(Int32(handle))
        cellOf[handle] = Int32(cell)
      } else if handle < cellOf.count {
        cellOf[handle] = -1
      }
    }
    count = alive
  }

  /// Handles whose grid cells overlap the padded region.
  func candidates(in region: MKCoordinateRegion, padding: Double = 0.2) -> [Int32] {
    guard count > 0, hasBounds else {
      return []
    }

    let latPad = region.span.latitudeDelta * padding
    let lonPad = region.span.longitudeDelta * padding
    let minLatQ = region.center.latitude - region.span.latitudeDelta / 2 - latPad
    let maxLatQ = region.center.latitude + region.span.latitudeDelta / 2 + latPad
    let minLonQ = region.center.longitude - region.span.longitudeDelta / 2 - lonPad
    let maxLonQ = region.center.longitude + region.span.longitudeDelta / 2 + lonPad
    guard maxLatQ >= minLat, minLatQ <= maxLat else {
      return []
    }

    let rowStart = clampedRow(minLatQ)
    let rowEnd = clampedRow(maxLatQ)
    let columns = longitudeColumnRange(minLon: minLonQ, maxLon: maxLonQ)

    var result: [Int32] = []
    var row = rowStart
    while row <= rowEnd {
      let base = row * cellsPerSide
      for column in columns {
        result.append(contentsOf: cells[base + column])
      }
      row += 1
    }
    return result
  }

  private func ensureCapacity(_ handle: Int) {
    guard handle >= cellOf.count else {
      return
    }
    cellOf.append(contentsOf: repeatElement(-1, count: handle + 1 - cellOf.count))
  }

  private func removeFromCell(_ handle: Int, cell: Int) {
    guard let position = cells[cell].firstIndex(of: Int32(handle)) else {
      return
    }
    cells[cell].swapAt(position, cells[cell].count - 1)
    cells[cell].removeLast()
  }

  private func contains(latitude: Double, longitude: Double) -> Bool {
    latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon
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

  private func clampedCellIndex(latitude: Double, longitude: Double) -> Int {
    clampedRow(latitude) * cellsPerSide + clampedColumn(longitude)
  }

  private func clampedRow(_ lat: Double) -> Int {
    min(cellsPerSide - 1, max(0, Int((lat - minLat) / latStep)))
  }

  private func clampedColumn(_ lon: Double) -> Int {
    min(cellsPerSide - 1, max(0, Int((lon - minLon) / lonStep)))
  }
}
