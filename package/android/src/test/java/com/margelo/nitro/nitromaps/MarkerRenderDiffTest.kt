package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerRenderDiffTest {
  private fun single(id: String, handle: Int, version: Long = 1L) =
    ClusterElement.Single(handle, marker(id = id), version)

  private fun cluster(count: Int, latitude: Double = 52.0) = ClusterElement.Cluster(
    id = "3:4",
    position = LatLng(latitude, 21.0),
    count = count,
    memberHandles = intArrayOf(1, 2, 3),
    bounds = LatLngBounds(LatLng(51.0, 20.0), LatLng(53.0, 22.0)),
  )

  @Test
  fun `new keys are added`() {
    val first = single("a", 0)
    val second = single("b", 1)
    val diff = computeMarkerRenderDiff(listOf(first, second), emptyMap())

    assertEquals(emptySet<MarkerRenderKey>(), diff.removedKeys)
    assertEquals(listOf(first, second), diff.added)
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `missing keys are removed`() {
    val kept = single("a", 0)
    val gone = MarkerRenderKey.Single(1, "gone")
    val diff = computeMarkerRenderDiff(
      listOf(kept),
      mapOf(kept.key to kept.renderVersion, gone to 9L),
    )

    assertEquals(setOf<MarkerRenderKey>(gone), diff.removedKeys)
    assertTrue(diff.added.isEmpty())
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `version change marks retained`() {
    val displayed = single("a", 0, version = 1L)
    val next = single("a", 0, version = 2L)
    val diff = computeMarkerRenderDiff(
      listOf(next),
      mapOf(displayed.key to displayed.renderVersion),
    )

    assertTrue(diff.removedKeys.isEmpty())
    assertTrue(diff.added.isEmpty())
    assertEquals(listOf(next), diff.retained)
  }

  @Test
  fun `unchanged version is skipped`() {
    val element = single("a", 0)
    val diff = computeMarkerRenderDiff(
      listOf(element),
      mapOf(element.key to element.renderVersion),
    )

    assertTrue(diff.removedKeys.isEmpty())
    assertTrue(diff.added.isEmpty())
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `duplicate keys keep the first element`() {
    val first = single("a", 0, version = 1L)
    val duplicate = single("a", 0, version = 2L)
    val diff = computeMarkerRenderDiff(listOf(first, duplicate), emptyMap())

    assertEquals(listOf(first), diff.added)
  }

  @Test
  fun `a reused handle with a new id is a different element`() {
    val previous = single("a", 0, version = 1L)
    val next = single("b", 0, version = 2L)
    val diff = computeMarkerRenderDiff(listOf(next), mapOf(previous.key to previous.renderVersion))

    assertEquals(setOf(previous.key), diff.removedKeys)
    assertEquals(listOf(next), diff.added)
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `cluster version follows count and position, not members`() {
    val base = cluster(count = 3)
    assertEquals(base.renderVersion, cluster(count = 3).renderVersion)
    assertNotEquals(base.renderVersion, cluster(count = 4).renderVersion)
    assertNotEquals(base.renderVersion, cluster(count = 3, latitude = 52.5).renderVersion)
    assertEquals(MarkerRenderKey.Cluster("3:4"), base.key)
  }
}
