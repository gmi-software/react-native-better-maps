package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Test

private const val TOLERANCE = 1e-9

class LatLngBoundsClusterZoomTest {
  @Test
  fun padsTheMembersSpreadByAFactorOfOnePointSix() {
    val zoomed =
      bounds(south = 52.0, west = 21.0, north = 52.5, east = 21.25).expandedForClusterZoom()

    assertEquals(51.85, zoomed.southwest.latitude, TOLERANCE)
    assertEquals(52.65, zoomed.northeast.latitude, TOLERANCE)
    assertEquals(20.925, zoomed.southwest.longitude, TOLERANCE)
    assertEquals(21.325, zoomed.northeast.longitude, TOLERANCE)
  }

  @Test
  fun givesStackedMembersTheMinimumSpanInsteadOfAPoint() {
    val zoomed =
      bounds(south = 52.2297, west = 21.0122, north = 52.2297, east = 21.0122).expandedForClusterZoom()

    assertEquals(52.2247, zoomed.southwest.latitude, TOLERANCE)
    assertEquals(52.2347, zoomed.northeast.latitude, TOLERANCE)
    assertEquals(21.0072, zoomed.southwest.longitude, TOLERANCE)
    assertEquals(21.0172, zoomed.northeast.longitude, TOLERANCE)
  }

  @Test
  fun keepsBoundsThatCrossTheAntimeridianAroundTheirCentre() {
    val zoomed =
      bounds(south = -1.0, west = 179.0, north = 1.0, east = -179.0).expandedForClusterZoom()

    assertEquals(-1.6, zoomed.southwest.latitude, TOLERANCE)
    assertEquals(1.6, zoomed.northeast.latitude, TOLERANCE)
    assertEquals(178.4, zoomed.southwest.longitude, TOLERANCE)
    assertEquals(-178.4, zoomed.northeast.longitude, TOLERANCE)
  }

  @Test
  fun leavesTheLongitudeSpanAloneWhenPaddingWouldWrapTheGlobe() {
    val zoomed =
      bounds(south = -10.0, west = -150.0, north = 10.0, east = 150.0).expandedForClusterZoom()

    assertEquals(-150.0, zoomed.southwest.longitude, TOLERANCE)
    assertEquals(150.0, zoomed.northeast.longitude, TOLERANCE)
  }

  @Test
  fun clusterZoomDeltaMatchesTheIosSpan() {
    assertEquals(0.01, clusterZoomDelta(0.0), TOLERANCE)
    assertEquals(0.01, clusterZoomDelta(0.006), TOLERANCE)
    assertEquals(0.016, clusterZoomDelta(0.01), TOLERANCE)
  }

  private fun bounds(
    south: Double,
    west: Double,
    north: Double,
    east: Double,
  ): LatLngBounds = LatLngBounds(LatLng(south, west), LatLng(north, east))
}
