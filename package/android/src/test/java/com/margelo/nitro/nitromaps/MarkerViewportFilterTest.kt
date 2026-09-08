package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class MarkerViewportFilterTest {
  private fun bounds(minLat: Double, minLon: Double, maxLat: Double, maxLon: Double) =
    LatLngBounds(LatLng(minLat, minLon), LatLng(maxLat, maxLon))

  @Test
  fun `keeps markers inside the padded bounds`() {
    val latitudes = doubleArrayOf(52.0, 52.0, 52.0)
    // The padding is a fifth of the span: 0.1 degrees here, so 21.05 is in and 21.15 is out.
    val longitudes = doubleArrayOf(21.0, 21.05, 21.15)
    val visible = MarkerViewportFilter.displaySubset(
      candidates = intArrayOf(0, 1, 2),
      latitudes = latitudes,
      longitudes = longitudes,
      bounds = bounds(51.5, 20.5, 52.5, 21.0),
      latitudeSpan = 1.0,
    )

    assertArrayEquals(intArrayOf(0, 1), visible.sortedArray())
  }

  @Test
  fun `bounds across the antimeridian keep markers on both sides`() {
    val latitudes = doubleArrayOf(0.0, 0.0, 0.0)
    val longitudes = doubleArrayOf(175.0, -175.0, 0.0)
    val visible = MarkerViewportFilter.displaySubset(
      candidates = intArrayOf(0, 1, 2),
      latitudes = latitudes,
      longitudes = longitudes,
      bounds = bounds(-5.0, 170.0, 5.0, -170.0),
      latitudeSpan = 10.0,
    )

    assertArrayEquals(intArrayOf(0, 1), visible.sortedArray())
  }

  @Test
  fun `subsampling across the antimeridian spreads over the columns`() {
    // 3,000 markers in a 20-degree window centred on the antimeridian; the
    // country-level cap is 200, so the subsample keeps about one per cell.
    val count = 3_000
    val latitudes = DoubleArray(count) { -4.0 + 8.0 * (it % 60) / 60.0 }
    val longitudes = DoubleArray(count) { 170.0 + 20.0 * (it / 60) / 50.0 }.map { if (it > 180.0) it - 360.0 else it }.toDoubleArray()
    val visible = MarkerViewportFilter.displaySubset(
      candidates = IntArray(count) { it },
      latitudes = latitudes,
      longitudes = longitudes,
      bounds = bounds(-5.0, 170.0, 5.0, -170.0),
      latitudeSpan = 10.0,
    )

    val east = visible.count { longitudes[it] > 0 }
    val west = visible.count { longitudes[it] < 0 }
    assertEquals(true, visible.size in 150..200)
    assertEquals(true, east > 50 && west > 50)
  }
}
