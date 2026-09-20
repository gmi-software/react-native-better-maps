package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class MarkerSpatialIndexTest {
  private val alive = MarkerStore.FLAG_ALIVE.toByte()

  private fun bounds(minLat: Double, minLon: Double, maxLat: Double, maxLon: Double) =
    LatLngBounds(LatLng(minLat, minLon), LatLng(maxLat, maxLon))

  @Test
  fun `queries find handles by cell after a rebuild`() {
    val index = MarkerSpatialIndex(cellsPerSide = 8)
    val latitudes = doubleArrayOf(52.0, 50.0, 54.0)
    val longitudes = doubleArrayOf(21.0, 19.0, 18.0)
    val flags = ByteArray(3) { alive }
    for (handle in 0 until 3) {
      index.insert(handle, latitudes[handle], longitudes[handle])
    }
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    assertEquals(3, index.count)
    assertArrayEquals(intArrayOf(0), index.candidates(bounds(51.9, 20.9, 52.1, 21.1), padding = 0.0).sortedArray())
    assertArrayEquals(intArrayOf(0, 1, 2), index.candidates(bounds(49.0, 17.0, 55.0, 22.0)).sortedArray())
    assertArrayEquals(intArrayOf(), index.candidates(bounds(10.0, 10.0, 11.0, 11.0)))
  }

  @Test
  fun `moving inside the bounds needs no rebuild`() {
    val index = MarkerSpatialIndex(cellsPerSide = 8)
    val latitudes = doubleArrayOf(52.0, 50.0)
    val longitudes = doubleArrayOf(21.0, 19.0)
    val flags = ByteArray(2) { alive }
    index.insert(0, 52.0, 21.0)
    index.insert(1, 50.0, 19.0)
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    index.move(0, 50.1, 19.1)
    // A rebuild with the stale arrays would put handle 0 back at 52.0/21.0;
    // an in-place move must not have flagged one.
    index.rebuildIfNeeded(latitudes, longitudes, flags)
    assertArrayEquals(intArrayOf(0, 1), index.candidates(bounds(49.9, 18.9, 50.2, 19.2), padding = 0.0).sortedArray())
    assertArrayEquals(intArrayOf(), index.candidates(bounds(51.9, 20.9, 52.1, 21.1), padding = 0.0))
  }

  @Test
  fun `queries beside the dataset in longitude find nothing`() {
    val index = MarkerSpatialIndex(cellsPerSide = 8)
    val latitudes = doubleArrayOf(52.0, 50.0)
    val longitudes = doubleArrayOf(21.0, 19.0)
    val flags = ByteArray(2) { alive }
    index.insert(0, 52.0, 21.0)
    index.insert(1, 50.0, 19.0)
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    assertArrayEquals(intArrayOf(), index.candidates(bounds(49.0, 100.0, 53.0, 110.0), padding = 0.0))
    assertArrayEquals(intArrayOf(), index.candidates(bounds(49.0, -60.0, 53.0, -50.0), padding = 0.0))
    assertArrayEquals(intArrayOf(0, 1), index.candidates(bounds(49.0, 18.0, 53.0, 22.0), padding = 0.0).sortedArray())
  }

  @Test
  fun `removeAll empties the index`() {
    val index = MarkerSpatialIndex(cellsPerSide = 8)
    val latitudes = doubleArrayOf(52.0, 50.0)
    val longitudes = doubleArrayOf(21.0, 19.0)
    val flags = ByteArray(2) { alive }
    index.insert(0, 52.0, 21.0)
    index.insert(1, 50.0, 19.0)
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    index.removeAll()

    assertEquals(0, index.count)
    assertArrayEquals(intArrayOf(), index.candidates(bounds(49.0, 18.0, 53.0, 22.0)))
  }

  @Test
  fun `leaving the bounds is fixed by the next rebuild`() {
    val index = MarkerSpatialIndex(cellsPerSide = 8)
    val latitudes = doubleArrayOf(52.0, 50.0)
    val longitudes = doubleArrayOf(21.0, 19.0)
    val flags = ByteArray(2) { alive }
    index.insert(0, 52.0, 21.0)
    index.insert(1, 50.0, 19.0)
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    latitudes[0] = 10.0
    longitudes[0] = 10.0
    index.move(0, 10.0, 10.0)
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    assertArrayEquals(intArrayOf(0), index.candidates(bounds(9.9, 9.9, 10.1, 10.1), padding = 0.0))
    assertArrayEquals(intArrayOf(1), index.candidates(bounds(49.9, 18.9, 50.1, 19.1), padding = 0.0))
  }

  @Test
  fun `removing a handle drops it from queries`() {
    val index = MarkerSpatialIndex(cellsPerSide = 8)
    val latitudes = doubleArrayOf(52.0, 52.0)
    val longitudes = doubleArrayOf(21.0, 21.0)
    val flags = ByteArray(2) { alive }
    index.insert(0, 52.0, 21.0)
    index.insert(1, 52.0, 21.0)
    index.rebuildIfNeeded(latitudes, longitudes, flags)

    index.remove(0)
    index.remove(0)

    assertEquals(1, index.count)
    assertArrayEquals(intArrayOf(1), index.candidates(bounds(51.0, 20.0, 53.0, 22.0)))
  }
}
