package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ShapeRenderVersionTest {
  private val route = arrayOf(Coordinate(52.2297, 21.0122), Coordinate(52.237, 21.017))

  private fun polyline(
    id: String = "route",
    coordinates: Array<Coordinate> = route,
    strokeColor: String? = "#FF0000",
    strokeWidth: Double? = 4.0,
    tappable: Boolean? = true,
  ) = PolylineDescriptor(id, coordinates, strokeColor, strokeWidth, tappable)

  private fun polygon(
    id: String = "district",
    coordinates: Array<Coordinate> = route,
    fillColor: String? = "#007AFF33",
    strokeColor: String? = "#007AFF",
    strokeWidth: Double? = 2.0,
    tappable: Boolean? = false,
  ) = PolygonDescriptor(id, coordinates, fillColor, strokeColor, strokeWidth, tappable)

  private fun circle(
    id: String = "radius",
    center: Coordinate = Coordinate(52.22, 21.01),
    radius: Double = 800.0,
    fillColor: String? = "#34C75933",
    strokeColor: String? = "#34C759",
    strokeWidth: Double? = 2.0,
    tappable: Boolean? = true,
  ) = CircleDescriptor(id, center, radius, fillColor, strokeColor, strokeWidth, tappable)

  @Test
  fun `equal descriptors share a version`() {
    assertEquals(polyline().renderVersion(), polyline(coordinates = route.copyOf()).renderVersion())
    assertEquals(polygon().renderVersion(), polygon(coordinates = route.copyOf()).renderVersion())
    assertEquals(circle().renderVersion(), circle().renderVersion())
  }

  @Test
  fun `every polyline field changes the version`() {
    val base = polyline().renderVersion()
    assertNotEquals("id", base, polyline(id = "other").renderVersion())
    assertNotEquals(
      "coordinate",
      base,
      polyline(coordinates = arrayOf(route[0], Coordinate(52.24, 21.02))).renderVersion(),
    )
    assertNotEquals("point count", base, polyline(coordinates = arrayOf(route[0])).renderVersion())
    assertNotEquals("strokeColor", base, polyline(strokeColor = "#00FF00").renderVersion())
    assertNotEquals("cleared strokeColor", base, polyline(strokeColor = null).renderVersion())
    assertNotEquals("strokeWidth", base, polyline(strokeWidth = 5.0).renderVersion())
    assertNotEquals("tappable", base, polyline(tappable = false).renderVersion())
  }

  @Test
  fun `every polygon field changes the version`() {
    val base = polygon().renderVersion()
    assertNotEquals("id", base, polygon(id = "other").renderVersion())
    assertNotEquals(
      "coordinate",
      base,
      polygon(coordinates = arrayOf(route[0], Coordinate(52.24, 21.02))).renderVersion(),
    )
    assertNotEquals("fillColor", base, polygon(fillColor = "#00000000").renderVersion())
    assertNotEquals("strokeColor", base, polygon(strokeColor = "#000000").renderVersion())
    assertNotEquals("strokeWidth", base, polygon(strokeWidth = 3.0).renderVersion())
    assertNotEquals("tappable", base, polygon(tappable = true).renderVersion())
  }

  @Test
  fun `every circle field changes the version`() {
    val base = circle().renderVersion()
    assertNotEquals("id", base, circle(id = "other").renderVersion())
    assertNotEquals("center", base, circle(center = Coordinate(52.23, 21.01)).renderVersion())
    assertNotEquals("radius", base, circle(radius = 900.0).renderVersion())
    assertNotEquals("fillColor", base, circle(fillColor = "#00000000").renderVersion())
    assertNotEquals("strokeColor", base, circle(strokeColor = "#000000").renderVersion())
    assertNotEquals("strokeWidth", base, circle(strokeWidth = 3.0).renderVersion())
    assertNotEquals("tappable", base, circle(tappable = false).renderVersion())
  }

  @Test
  fun `absent and zero valued fields are distinguishable`() {
    assertNotEquals(polyline(strokeWidth = null).renderVersion(), polyline(strokeWidth = 0.0).renderVersion())
    assertNotEquals(circle(tappable = null).renderVersion(), circle(tappable = false).renderVersion())
  }

  @Test
  fun `region equality tolerates rounding but not real changes`() {
    val region = Region(52.2297, 21.0122, 0.1, 0.2)
    assertEquals(true, region.approximatelyEquals(Region(52.2297 + 1e-9, 21.0122, 0.1, 0.2)))
    assertEquals(false, region.approximatelyEquals(Region(52.2397, 21.0122, 0.1, 0.2)))
    assertEquals(false, region.approximatelyEquals(Region(52.2297, 21.0122, 0.1, 0.3)))
  }
}
