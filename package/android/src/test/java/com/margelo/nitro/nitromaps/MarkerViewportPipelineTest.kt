package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [MarkerRenderState], [MarkerSpatialIndex] and [MarkerClusterEngine] in the order
 * [MapOverlayController] runs them with clustering on; `LatLngBounds` is plain Java, so no map
 * is needed.
 *
 * The viewport is 2 degrees square at 1080 x 1920 px and density 2.75, which makes the grid cells
 * 0.25 degrees on a side: everything up to 0.25 degrees north-east of (0, 0) shares one.
 */
class MarkerViewportPipelineTest {
  private val viewport = LatLngBounds(LatLng(-1.0, -1.0), LatLng(1.0, 1.0))
  private val unplaceable = Coordinate(latitude = Double.NaN, longitude = Double.NaN)

  @Test
  fun `markers that share a grid cell form one cluster`() {
    val cluster = clusters(marker(id = "a", coordinate = point(0.01)), marker(id = "b", coordinate = point(0.02)))

    assertEquals(listOf("a", "b"), (cluster.single() as ClusterElement.Cluster).memberIds)
  }

  @Test
  fun `markers that cannot be placed never reach a cluster`() {
    // `floor(NaN).toInt()` is 0, so unfiltered they share the (0, 0) cell with the real markers
    // and turn the cluster's bounds into NaN, which `LatLngBounds` throws on.
    val cluster =
      clusters(
        marker(id = "a", coordinate = point(0.01)),
        marker(id = "bad-1", coordinate = unplaceable),
        marker(id = "b", coordinate = point(0.02)),
        marker(id = "bad-2", coordinate = unplaceable),
      )

    assertEquals(listOf("a", "b"), (cluster.single() as ClusterElement.Cluster).memberIds)
  }

  @Test
  fun `a dataset with nothing that can be placed clusters to nothing`() {
    val elements = clusters(marker(id = "bad-1", coordinate = unplaceable), marker(id = "bad-2", coordinate = unplaceable))

    assertTrue(elements.isEmpty())
  }

  private fun clusters(vararg markers: MarkerDescriptor): List<ClusterElement> {
    val state = MarkerRenderState()
    state.attachMap()
    state.setClusteringEnabled(true)
    state.setMarkers(arrayOf(*markers))

    val candidates = MarkerSpatialIndex(state.descriptors).candidates(viewport)
    return MarkerClusterEngine.clusters(candidates, viewport, VIEW_WIDTH_PX, VIEW_HEIGHT_PX, DENSITY)
  }

  private fun point(degrees: Double): Coordinate = Coordinate(latitude = degrees, longitude = degrees)

  private companion object {
    const val VIEW_WIDTH_PX = 1080
    const val VIEW_HEIGHT_PX = 1920
    const val DENSITY = 2.75f
  }
}
