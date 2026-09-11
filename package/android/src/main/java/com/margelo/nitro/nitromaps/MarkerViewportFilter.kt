package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
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
   * main thread.
   */
  fun displaySubset(
    candidates: List<MarkerDescriptor>,
    bounds: LatLngBounds,
    latitudeSpan: Double,
  ): List<MarkerDescriptor> {
    val maxCount = maxMarkersForZoom(latitudeSpan)
    val paddedBounds = bounds.expandBy(0.2)

    val visible =
      candidates.filter { descriptor ->
        paddedBounds.contains(
          LatLng(descriptor.coordinate.latitude, descriptor.coordinate.longitude),
        )
      }

    if (visible.size <= maxCount) {
      return visible
    }

    return spatialSubsample(visible, maxCount, bounds).toList()
  }

  private fun spatialSubsample(
    markers: List<MarkerDescriptor>,
    maxCount: Int,
    bounds: LatLngBounds,
  ): Array<MarkerDescriptor> {
    val columns = ceil(sqrt(maxCount.toDouble())).toInt()
    val rows = ceil(maxCount.toDouble() / columns).toInt()

    val latMin = bounds.southwest.latitude
    val latMax = bounds.northeast.latitude
    val lonMin = bounds.southwest.longitude
    val lonMax = bounds.northeast.longitude

    val latStep = max(1e-9, (latMax - latMin) / rows)
    val lonStep = max(1e-9, (lonMax - lonMin) / columns)

    val buckets = LinkedHashMap<String, MutableList<MarkerDescriptor>>()

    for (marker in markers) {
      val row = minOf(rows - 1, maxOf(0, ((marker.coordinate.latitude - latMin) / latStep).toInt()))
      val column = minOf(columns - 1, maxOf(0, ((marker.coordinate.longitude - lonMin) / lonStep).toInt()))
      val key = "$row-$column"
      buckets.getOrPut(key) { mutableListOf() }.add(marker)
    }

    return buckets.values.map { cell -> cell[cell.size / 2] }.toTypedArray()
  }

  private fun maxMarkersForZoom(latitudeSpan: Double): Int {
    return when {
      latitudeSpan < 0.08 -> 2_000
      latitudeSpan < 0.5 -> 800
      latitudeSpan < 2.0 -> 350
      else -> 200
    }
  }

  private fun LatLngBounds.expandBy(fraction: Double): LatLngBounds {
    val latSpan = northeast.latitude - southwest.latitude
    val lngSpan = northeast.longitude - southwest.longitude
    val latPad = latSpan * fraction
    val lngPad = lngSpan * fraction

    return LatLngBounds(
      LatLng(southwest.latitude - latPad, southwest.longitude - lngPad),
      LatLng(northeast.latitude + latPad, northeast.longitude + lngPad),
    )
  }
}
