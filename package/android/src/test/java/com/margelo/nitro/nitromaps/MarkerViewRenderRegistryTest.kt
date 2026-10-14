package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerViewRenderRegistryTest {
  private fun cluster(count: Int = 2) =
    ClusterElement.Cluster(
      "grid",
      LatLng(52.0, 21.0),
      count,
      listOf("b", "a"),
      LatLngBounds(LatLng(51.99, 20.99), LatLng(52.01, 21.01)),
    )

  private fun live(id: String = "a") = ClusterElement.Single(marker(id = id, liveView = true))

  private fun MarkerViewRenderRegistry.diff(vararg elements: ClusterElement) =
    consume(computeMarkerRenderDiff(elements.toList(), displayedVersions(emptyMap())))

  @Test
  fun `live and SDK markers share one display set`() {
    val registry = MarkerViewRenderRegistry()
    var state: NativeMarkerViewRenderState? = null
    registry.onChange = { state = it }
    val sdkMarker = ClusterElement.Single(marker(id = "b"))

    val sdk = registry.diff(live(), sdkMarker)

    assertEquals(listOf(sdkMarker), sdk.added)
    assertEquals(listOf("a"), state!!.markerIds.toList())
    assertEquals(mapOf(live().diffKey to live().renderVersion), registry.displayedVersions(emptyMap()))
  }

  @Test
  fun `collapsing into a JSX cluster unmounts its members and expanding mounts them again`() {
    val registry = MarkerViewRenderRegistry().apply { setCustomClusters(true) }
    var state: NativeMarkerViewRenderState? = null
    registry.onChange = { state = it }
    registry.diff(live())

    val collapsed = registry.diff(cluster())
    assertTrue(collapsed.added.isEmpty())
    assertTrue(state!!.markerIds.isEmpty())
    assertEquals(listOf("a", "b"), state!!.clusters.single().markerIds.toList())

    registry.diff(live())
    assertTrue(state!!.clusters.isEmpty())
    assertEquals(listOf("a"), state!!.markerIds.toList())
  }

  @Test
  fun `a JSX cluster whose count changes is published again`() {
    val registry = MarkerViewRenderRegistry().apply { setCustomClusters(true) }
    var updates = 0
    registry.onChange = { updates += 1 }
    registry.diff(cluster(count = 2))
    val before = updates

    registry.diff(cluster(count = 3))

    assertEquals(before + 1, updates)
  }

  @Test
  fun `default cluster badges stay with the SDK`() {
    val registry = MarkerViewRenderRegistry()

    val sdk = registry.diff(cluster())

    assertEquals(listOf(cluster()), sdk.added)
    assertTrue(registry.displayedVersions(emptyMap()).isEmpty())
  }

  @Test
  fun `camera refreshes that leave the set unchanged do not reach JS`() {
    val registry = MarkerViewRenderRegistry()
    var updates = 0
    registry.onChange = { updates += 1 }
    registry.diff(live())
    val before = updates

    repeat(120) { registry.diff(live()) }
    // A live marker that moved is still the same mounted host; JS sent the move.
    registry.diff(ClusterElement.Single(marker(id = "a", coordinate = Coordinate(1.0, 2.0), liveView = true)))

    assertEquals(before, updates)
    registry.reset()
    assertEquals(before + 1, updates)
    assertTrue(registry.displayedVersions(emptyMap()).isEmpty())
  }

  @Test
  fun `a marker that stops being live is added to the SDK`() {
    val registry = MarkerViewRenderRegistry()
    registry.diff(live())
    val sdkMarker = ClusterElement.Single(marker(id = "a"))

    val sdk = registry.diff(sdkMarker)

    assertEquals(listOf(sdkMarker), sdk.added)
    assertTrue(registry.displayedVersions(emptyMap()).isEmpty())
  }

  @Test
  fun `a marker that becomes live is removed from the SDK`() {
    val registry = MarkerViewRenderRegistry()
    val sdkMarker = ClusterElement.Single(marker(id = "a"))
    val sdkVersions = mapOf(sdkMarker.diffKey to sdkMarker.renderVersion)

    val sdk = registry.consume(computeMarkerRenderDiff(listOf(live()), registry.displayedVersions(sdkVersions)))

    assertEquals(setOf(sdkMarker.diffKey), sdk.removedKeys)
    assertTrue(sdk.added.isEmpty() && sdk.retained.isEmpty())
  }
}
