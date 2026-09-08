package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLngBounds

/**
 * Uniform grid spatial index over marker handles.
 *
 * Cells hold handles, not descriptors, and the grid is updated in place as
 * markers are inserted, moved and removed, so a moving marker costs one cell
 * swap instead of a rebuild. The grid bounds are computed over the dataset
 * with a margin; a marker that lands outside them flags a rebuild, which the
 * store runs once at the end of the batch that caused it.
 *
 * Not thread-safe on its own: the owning [MarkerStore] serializes access.
 */
internal class MarkerSpatialIndex(cellsPerSide: Int = 96) {
  private val side: Int = maxOf(1, cellsPerSide)
  private var minLat = 0.0
  private var maxLat = 0.0
  private var minLon = 0.0
  private var maxLon = 0.0
  private var latStep = 1.0
  private var lonStep = 1.0
  private var hasBounds = false
  private var needsRebuild = false
  private val cells: Array<IntList> = Array(side * side) { IntList() }
  /** Cell index per handle, -1 when the handle is not indexed. */
  private var cellOf = IntArray(0)
  var count = 0
    private set

  fun insert(handle: Int, latitude: Double, longitude: Double) {
    ensureCapacity(handle)
    if (cellOf[handle] >= 0) {
      move(handle, latitude, longitude)
      return
    }

    count += 1
    if (!hasBounds || !contains(latitude, longitude)) {
      needsRebuild = true
    }
    val cell = clampedCellIndex(latitude, longitude)
    cells[cell].add(handle)
    cellOf[handle] = cell
  }

  fun move(handle: Int, latitude: Double, longitude: Double) {
    if (handle >= cellOf.size || cellOf[handle] < 0) {
      insert(handle, latitude, longitude)
      return
    }

    if (!contains(latitude, longitude)) {
      needsRebuild = true
    }
    val current = cellOf[handle]
    val next = clampedCellIndex(latitude, longitude)
    if (next == current) {
      return
    }
    cells[current].removeValue(handle)
    cells[next].add(handle)
    cellOf[handle] = next
  }

  fun remove(handle: Int) {
    if (handle >= cellOf.size || cellOf[handle] < 0) {
      return
    }
    cells[cellOf[handle]].removeValue(handle)
    cellOf[handle] = -1
    count -= 1
  }

  fun removeAll() {
    cells.forEach { it.clear() }
    cellOf = IntArray(0)
    count = 0
    hasBounds = false
    needsRebuild = false
  }

  /**
   * Recomputes the grid over every live marker if one fell outside the current
   * bounds. Called once per applied batch, before any query.
   */
  fun rebuildIfNeeded(latitudes: DoubleArray, longitudes: DoubleArray, flags: ByteArray) {
    if (!needsRebuild) {
      return
    }
    needsRebuild = false

    var minLatV = Double.MAX_VALUE
    var maxLatV = -Double.MAX_VALUE
    var minLonV = Double.MAX_VALUE
    var maxLonV = -Double.MAX_VALUE
    var alive = 0
    for (handle in flags.indices) {
      if (flags[handle].toInt() and MarkerStore.FLAG_ALIVE == 0) continue
      alive += 1
      if (latitudes[handle] < minLatV) minLatV = latitudes[handle]
      if (latitudes[handle] > maxLatV) maxLatV = latitudes[handle]
      if (longitudes[handle] < minLonV) minLonV = longitudes[handle]
      if (longitudes[handle] > maxLonV) maxLonV = longitudes[handle]
    }

    cells.forEach { it.clear() }
    if (alive == 0) {
      hasBounds = false
      cellOf.fill(-1)
      count = 0
      return
    }

    // A margin keeps ordinary movement inside the grid; only a marker that
    // leaves the dataset's neighbourhood triggers the next rebuild.
    val latPad = maxOf((maxLatV - minLatV) * 0.15, 1e-6)
    val lonPad = maxOf((maxLonV - minLonV) * 0.15, 1e-6)
    minLat = minLatV - latPad
    maxLat = maxLatV + latPad
    minLon = minLonV - lonPad
    maxLon = maxLonV + lonPad
    latStep = maxOf(1e-9, (maxLat - minLat) / side)
    lonStep = maxOf(1e-9, (maxLon - minLon) / side)
    hasBounds = true

    ensureCapacity(flags.size - 1)
    for (handle in flags.indices) {
      if (flags[handle].toInt() and MarkerStore.FLAG_ALIVE != 0) {
        val cell = clampedCellIndex(latitudes[handle], longitudes[handle])
        cells[cell].add(handle)
        cellOf[handle] = cell
      } else {
        cellOf[handle] = -1
      }
    }
    count = alive
  }

  /** Handles whose grid cells overlap the padded bounds. */
  fun candidates(bounds: LatLngBounds, padding: Double = 0.2): IntArray {
    if (count == 0 || !hasBounds) {
      return IntArray(0)
    }

    val latSpan = bounds.northeast.latitude - bounds.southwest.latitude
    val lonSpan = if (bounds.northeast.longitude < bounds.southwest.longitude) {
      bounds.northeast.longitude - bounds.southwest.longitude + 360.0
    } else {
      bounds.northeast.longitude - bounds.southwest.longitude
    }
    val latPad = latSpan * padding
    val lonPad = lonSpan * padding
    val minLatQ = bounds.southwest.latitude - latPad
    val maxLatQ = bounds.northeast.latitude + latPad
    if (maxLatQ < minLat || minLatQ > maxLat) {
      return IntArray(0)
    }

    val minLonQ = bounds.southwest.longitude - lonPad
    val maxLonQ = bounds.northeast.longitude + lonPad
    if (!overlapsLongitude(minLonQ, maxLonQ)) {
      return IntArray(0)
    }

    val rowStart = clampedRow(minLatQ)
    val rowEnd = clampedRow(maxLatQ)
    val result = IntList(64)
    val columns = longitudeColumns(minLonQ, maxLonQ)
    var row = rowStart
    while (row <= rowEnd) {
      val base = row * side
      for (column in columns) {
        result.addAll(cells[base + column])
      }
      row += 1
    }
    return result.toIntArray()
  }

  private fun ensureCapacity(handle: Int) {
    if (handle < cellOf.size) {
      return
    }
    val previous = cellOf.size
    cellOf = cellOf.copyOf(maxOf(handle + 1, previous * 2, 64))
    cellOf.fill(-1, previous, cellOf.size)
  }

  /**
   * Whether a query's longitude range, which may cross the antimeridian, meets
   * the grid's. Without this a query east or west of the dataset would clamp to
   * the outermost column and return everything in it.
   */
  private fun overlapsLongitude(minLonQ: Double, maxLonQ: Double): Boolean {
    if (maxLonQ - minLonQ >= 360.0) {
      return true
    }
    val wrappedMin = wrapLongitude(minLonQ)
    val wrappedMax = wrapLongitude(maxLonQ)
    return if (wrappedMin <= wrappedMax) {
      wrappedMax >= minLon && wrappedMin <= maxLon
    } else {
      maxLon >= wrappedMin || minLon <= wrappedMax
    }
  }

  private fun contains(latitude: Double, longitude: Double): Boolean {
    return latitude >= minLat && latitude <= maxLat && longitude >= minLon && longitude <= maxLon
  }

  private fun longitudeColumns(minLon: Double, maxLon: Double): List<Int> {
    if (maxLon - minLon >= 360.0) {
      return (0 until side).toList()
    }

    val wrappedMin = wrapLongitude(minLon)
    val wrappedMax = wrapLongitude(maxLon)
    if (wrappedMin <= wrappedMax && maxLon <= 180.0 && minLon >= -180.0) {
      return (clampedColumn(wrappedMin)..clampedColumn(wrappedMax)).toList()
    }

    val firstRange = clampedColumn(wrappedMin) until side
    val secondRange = 0..clampedColumn(wrappedMax)
    return firstRange.toList() + secondRange.toList()
  }

  private fun wrapLongitude(lon: Double): Double {
    var wrapped = lon
    while (wrapped > 180.0) wrapped -= 360.0
    while (wrapped < -180.0) wrapped += 360.0
    return wrapped
  }

  private fun clampedCellIndex(lat: Double, lon: Double): Int {
    return clampedRow(lat) * side + clampedColumn(lon)
  }

  private fun clampedRow(lat: Double): Int {
    return minOf(side - 1, maxOf(0, ((lat - minLat) / latStep).toInt()))
  }

  private fun clampedColumn(lon: Double): Int {
    return minOf(side - 1, maxOf(0, ((lon - minLon) / lonStep).toInt()))
  }
}
