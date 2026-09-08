package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ClusterOctaveCacheTest {
  private val count = 400
  private val latitudes = DoubleArray(count) { 52.0 + (it % 20) * 0.01 }
  private val longitudes = DoubleArray(count) { 21.0 + (it / 20) * 0.01 }
  private val flags = ByteArray(count) { (MarkerStore.FLAG_ALIVE or MarkerStore.FLAG_CLUSTERABLE).toByte() }
  private val candidates = IntArray(count) { it }

  private fun bounds(centerLat: Double, centerLon: Double, span: Double = 0.1) =
    LatLngBounds(LatLng(centerLat - span / 2, centerLon - span / 2), LatLng(centerLat + span / 2, centerLon + span / 2))

  private fun run(
    bounds: LatLngBounds,
    cache: ClusterOctaveCache?,
    generation: Long = 1L,
    candidates: IntArray = this.candidates,
  ) = MarkerClusterEngine.clusters(candidates, latitudes, longitudes, flags, bounds, 1080, 1920, 3f, cache, generation)

  /** What the spatial index would hand the engine: the handles near the padded bounds. */
  private fun candidatesNear(bounds: LatLngBounds): IntArray {
    val latPad = (bounds.northeast.latitude - bounds.southwest.latitude) * 0.25
    val lonPad = (bounds.northeast.longitude - bounds.southwest.longitude) * 0.25
    return candidates.filter { handle ->
      latitudes[handle] in (bounds.southwest.latitude - latPad)..(bounds.northeast.latitude + latPad) &&
        longitudes[handle] in (bounds.southwest.longitude - lonPad)..(bounds.northeast.longitude + lonPad)
    }.toIntArray()
  }

  private fun signature(elements: List<MarkerClusterEngine.Element>): List<String> =
    elements.map { element ->
      when (element) {
        is MarkerClusterEngine.Element.Single -> "s${element.handle}"
        is MarkerClusterEngine.Element.Cluster -> "c${element.id}:${element.count}:${element.memberHandles.sorted()}"
      }
    }.sorted()

  @Test
  fun `cached refreshes match uncached ones`() {
    val cache = ClusterOctaveCache()
    val first = bounds(52.1, 21.1)
    val uncached = run(first, null)

    val warm = run(first, cache)
    assertEquals(0L, cache.reusedCandidates)
    val reused = run(first, cache)
    assertTrue(cache.reusedCandidates > 0)

    assertEquals(signature(uncached), signature(warm))
    assertEquals(signature(uncached), signature(reused))
  }

  @Test
  fun `a pan reuses the cells that stay in view`() {
    val cache = ClusterOctaveCache()
    run(bounds(52.1, 21.1), cache)
    val panned = bounds(52.12, 21.12)

    val cached = run(panned, cache)
    val fresh = run(panned, null)

    assertTrue(cache.reusedCandidates > 0)
    assertEquals(signature(fresh), signature(cached))
  }

  @Test
  fun `a pan drops the cells that left the padded region`() {
    val cache = ClusterOctaveCache()
    val first = bounds(52.05, 21.05, span = 0.06)
    run(first, cache, candidates = candidatesNear(first))
    // Far enough that cells of the first viewport fall outside the padded second one.
    val panned = bounds(52.15, 21.15, span = 0.06)
    val nearPanned = candidatesNear(panned)

    val cached = run(panned, cache, candidates = nearPanned)
    val fresh = run(panned, null, candidates = nearPanned)

    assertEquals(signature(fresh), signature(cached))
    val members = cached.flatMap { element ->
      when (element) {
        is MarkerClusterEngine.Element.Single -> listOf(element.handle)
        is MarkerClusterEngine.Element.Cluster -> element.memberHandles.toList()
      }
    }
    assertTrue(members.all { it in nearPanned })
  }

  @Test
  fun `a dataset change drops the cache`() {
    val cache = ClusterOctaveCache()
    val view = bounds(52.1, 21.1)
    run(view, cache, generation = 1L)
    latitudes[0] = 52.19
    val fresh = run(view, null)

    val afterChange = run(view, cache, generation = 2L)

    assertEquals(0L, cache.reusedCandidates)
    assertEquals(signature(fresh), signature(afterChange))
  }

  @Test
  fun `a zoom octave change drops the cache`() {
    val cache = ClusterOctaveCache()
    run(bounds(52.1, 21.1, span = 0.1), cache)
    val zoomed = bounds(52.1, 21.1, span = 0.4)

    val cached = run(zoomed, cache)
    val fresh = run(zoomed, null)

    assertEquals(0L, cache.reusedCandidates)
    assertEquals(signature(fresh), signature(cached))
  }
}
