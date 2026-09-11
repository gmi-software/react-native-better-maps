package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.*
import org.junit.Test

class MarkerViewRenderRegistryTest {
  private fun cluster() = ClusterElement.Cluster(
    "grid", LatLng(52.0, 21.0), 2, listOf("b", "a"),
    LatLngBounds(LatLng(51.99, 20.99), LatLng(52.01, 21.01)),
  )

  @Test fun `mixed native and Fabric markers share the display set`() {
    val registry = MarkerViewRenderRegistry()
    var state: NativeMarkerViewRenderState? = null
    registry.onChange = { state = it }
    val live = ClusterElement.Single(marker(id = "a", customViewId = "view-a"))
    val native = ClusterElement.Single(marker(id = "b"))
    val sdk = registry.consume(computeMarkerRenderDiff(listOf(live, native), emptyMap()))
    assertEquals(listOf(native), sdk.added)
    assertEquals(listOf("view-a"), state!!.markerViewIds.toList())
    assertEquals(mapOf(live.diffKey to live.renderVersion), registry.versions)
  }

  @Test fun `collapsing and expanding a cluster replaces the mounted JSX set`() {
    val registry = MarkerViewRenderRegistry().apply { customClusters = true }
    var state: NativeMarkerViewRenderState? = null
    registry.onChange = { state = it }
    val live = ClusterElement.Single(marker(id = "a", customViewId = "view-a"))
    registry.consume(computeMarkerRenderDiff(listOf(live), emptyMap()))
    val collapsed = registry.consume(computeMarkerRenderDiff(listOf(cluster()), registry.versions))
    assertTrue(collapsed.added.isEmpty())
    assertTrue(state!!.markerViewIds.isEmpty())
    assertEquals(listOf("a", "b"), state!!.clusters.single().markerIds.toList())
    registry.consume(computeMarkerRenderDiff(listOf(live), registry.versions))
    assertTrue(state!!.clusters.isEmpty())
    assertEquals(listOf("view-a"), state!!.markerViewIds.toList())
  }

  @Test fun `default cluster badges stay in the SDK`() {
    val registry = MarkerViewRenderRegistry()
    assertEquals(listOf(cluster()), registry.consume(
      computeMarkerRenderDiff(listOf(cluster()), emptyMap()),
    ).added)
    assertTrue(registry.versions.isEmpty())
  }

  @Test fun `unchanged display membership does not emit camera-frame JS work`() {
    val registry = MarkerViewRenderRegistry()
    var updates = 0
    registry.onChange = { updates++ }
    val live = ClusterElement.Single(marker(customViewId = "view-a"))
    registry.consume(computeMarkerRenderDiff(listOf(live), emptyMap()))
    val before = updates
    repeat(120) { registry.consume(computeMarkerRenderDiff(listOf(live), registry.versions)) }
    assertEquals(before, updates)
    registry.reset()
    assertTrue(registry.versions.isEmpty())
    assertEquals(before + 1, updates)
  }

  @Test fun `switching a retained marker back to SDK creates its native object`() {
    val registry = MarkerViewRenderRegistry()
    val live = ClusterElement.Single(marker(customViewId = "view-a"))
    registry.consume(computeMarkerRenderDiff(listOf(live), emptyMap()))
    val native = ClusterElement.Single(marker())
    val sdk = registry.consume(computeMarkerRenderDiff(listOf(native), registry.versions))
    assertEquals(listOf(native), sdk.added)
    assertTrue(registry.versions.isEmpty())
  }
}
