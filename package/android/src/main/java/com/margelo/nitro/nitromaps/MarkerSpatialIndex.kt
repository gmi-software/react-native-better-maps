package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLngBounds

/**
 * Uniform grid spatial index over a marker dataset.
 *
 * Built once per dataset so viewport queries cost O(cells in view + markers in
 * those cells) instead of O(all markers). Immutable after construction, so
 * instances are safe to query from a background thread.
 */
internal class MarkerSpatialIndex(
  markers: Array<MarkerDescriptor>,
  cellsPerSide: Int = 96,
) {
  val count: Int = markers.size
  private val side: Int = maxOf(1, cellsPerSide)
  private val minLat: Double
  private val minLon: Double
  private val latStep: Double
  private val lonStep: Double
  private val cells: Array<MutableList<MarkerDescriptor>>

  init {
    var minLatV = Double.MAX_VALUE
    var maxLatV = -Double.MAX_VALUE
    var minLonV = Double.MAX_VALUE
    var maxLonV = -Double.MAX_VALUE

    for (marker in markers) {
      val lat = marker.coordinate.latitude
      val lon = marker.coordinate.longitude
      if (lat < minLatV) minLatV = lat
      if (lat > maxLatV) maxLatV = lat
      if (lon < minLonV) minLonV = lon
      if (lon > maxLonV) maxLonV = lon
    }

    if (markers.isEmpty()) {
      minLatV = 0.0
      maxLatV = 0.0
      minLonV = 0.0
      maxLonV = 0.0
    }

    minLat = minLatV
    minLon = minLonV
    latStep = maxOf(1e-9, (maxLatV - minLatV) / side)
    lonStep = maxOf(1e-9, (maxLonV - minLonV) / side)
    cells = Array(side * side) { mutableListOf() }

    for (marker in markers) {
      val index = cellIndex(marker.coordinate.latitude, marker.coordinate.longitude)
      cells[index].add(marker)
    }
  }

  /** Markers whose grid cells overlap the padded bounds. */
  fun candidates(
    bounds: LatLngBounds,
    padding: Double = 0.2,
  ): List<MarkerDescriptor> {
    if (count == 0) {
      return emptyList()
    }

    val latSpan = bounds.northeast.latitude - bounds.southwest.latitude
    val lonSpan =
      if (bounds.northeast.longitude < bounds.southwest.longitude) {
        bounds.northeast.longitude - bounds.southwest.longitude + 360.0
      } else {
        bounds.northeast.longitude - bounds.southwest.longitude
      }
    val latPad = latSpan * padding
    val lonPad = lonSpan * padding

    val rowStart = clampedRow(bounds.southwest.latitude - latPad)
    val rowEnd = clampedRow(bounds.northeast.latitude + latPad)
    val minLonQ = bounds.southwest.longitude - lonPad
    val maxLonQ = bounds.northeast.longitude + lonPad

    val result = ArrayList<MarkerDescriptor>()
    val columns = longitudeColumns(minLonQ, maxLonQ)
    var row = rowStart
    while (row <= rowEnd) {
      val base = row * side
      for (column in columns) {
        result.addAll(cells[base + column])
      }
      row += 1
    }
    return result
  }

  private fun longitudeColumns(
    minLon: Double,
    maxLon: Double,
  ): List<Int> {
    if (maxLon - minLon >= 360.0) {
      return (0 until side).toList()
    }

    val wrappedMin = wrapLongitude(minLon)
    val wrappedMax = wrapLongitude(maxLon)
    if (wrappedMin <= wrappedMax && maxLon <= 180.0 && minLon >= -180.0) {
      val colStart = clampedColumn(wrappedMin)
      val colEnd = clampedColumn(wrappedMax)
      return (colStart..colEnd).toList()
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

  private fun cellIndex(
    lat: Double,
    lon: Double,
  ): Int {
    return clampedRow(lat) * side + clampedColumn(lon)
  }

  private fun clampedRow(lat: Double): Int {
    return minOf(side - 1, maxOf(0, ((lat - minLat) / latStep).toInt()))
  }

  private fun clampedColumn(lon: Double): Int {
    return minOf(side - 1, maxOf(0, ((lon - minLon) / lonStep).toInt()))
  }
}
