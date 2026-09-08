package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLngBounds
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.sqrt

internal object MarkerViewportFilter {
  /**
   * Precise viewport filter + spatial subsample over pre-narrowed candidates.
   *
   * The caller (spatial index) has already restricted [candidates] to cells
   * near the bounds, so this runs over a small set and is safe to call off the
   * UI thread. Coordinates come from the store's flat arrays.
   */
  fun displaySubset(
    candidates: IntArray,
    latitudes: DoubleArray,
    longitudes: DoubleArray,
    bounds: LatLngBounds,
    latitudeSpan: Double,
  ): IntArray {
    val maxCount = maxMarkersForZoom(latitudeSpan)
    val latSpan = bounds.northeast.latitude - bounds.southwest.latitude
    val lngSpan = bounds.northeast.longitude - bounds.southwest.longitude
    val minLat = bounds.southwest.latitude - latSpan * 0.2
    val maxLat = bounds.northeast.latitude + latSpan * 0.2
    val minLon = bounds.southwest.longitude - lngSpan * 0.2
    val maxLon = bounds.northeast.longitude + lngSpan * 0.2

    val visible = IntList(candidates.size.coerceAtLeast(1))
    for (handle in candidates) {
      val lat = latitudes[handle]
      val lon = longitudes[handle]
      val lonInside = if (minLon <= maxLon) lon in minLon..maxLon else lon >= minLon || lon <= maxLon
      if (lat >= minLat && lat <= maxLat && lonInside) {
        visible.add(handle)
      }
    }

    if (visible.size <= maxCount) {
      return visible.toIntArray()
    }

    return spatialSubsample(visible, latitudes, longitudes, maxCount, bounds)
  }

  private fun spatialSubsample(
    handles: IntList,
    latitudes: DoubleArray,
    longitudes: DoubleArray,
    maxCount: Int,
    bounds: LatLngBounds,
  ): IntArray {
    val columns = ceil(sqrt(maxCount.toDouble())).toInt()
    val rows = ceil(maxCount.toDouble() / columns).toInt()

    val latMin = bounds.southwest.latitude
    val latMax = bounds.northeast.latitude
    val lonMin = bounds.southwest.longitude
    val lonMax = bounds.northeast.longitude

    val latStep = max(1e-9, (latMax - latMin) / rows)
    val lonStep = max(1e-9, (lonMax - lonMin) / columns)

    val buckets = LinkedHashMap<Int, IntList>()
    for (index in 0 until handles.size) {
      val handle = handles[index]
      val row = minOf(rows - 1, maxOf(0, ((latitudes[handle] - latMin) / latStep).toInt()))
      val column = minOf(columns - 1, maxOf(0, ((longitudes[handle] - lonMin) / lonStep).toInt()))
      buckets.getOrPut(row * columns + column) { IntList() }.add(handle)
    }

    val result = IntArray(buckets.size)
    var position = 0
    for (cell in buckets.values) {
      result[position] = cell[cell.size / 2]
      position += 1
    }
    return result
  }

  private fun maxMarkersForZoom(latitudeSpan: Double): Int {
    return when {
      latitudeSpan < 0.08 -> 2_000
      latitudeSpan < 0.5 -> 800
      latitudeSpan < 2.0 -> 350
      else -> 200
    }
  }
}
