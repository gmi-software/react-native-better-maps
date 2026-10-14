package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ShapeRenderVersionTest {
  private fun assertGeometryOnly(
    field: String,
    base: ShapeRenderVersion,
    next: ShapeRenderVersion,
  ) {
    assertNotEquals("$field changes the geometry", base.geometry, next.geometry)
    assertEquals("$field leaves the style", base.style, next.style)
  }

  private fun assertStyleOnly(
    field: String,
    base: ShapeRenderVersion,
    next: ShapeRenderVersion,
  ) {
    assertEquals("$field leaves the geometry", base.geometry, next.geometry)
    assertNotEquals("$field changes the style", base.style, next.style)
  }

  @Test
  fun `equal descriptors share a version`() {
    assertEquals(polylineDescriptor().renderVersion(), polylineDescriptor(coordinates = ROUTE.copyOf()).renderVersion())
    assertEquals(polygonDescriptor().renderVersion(), polygonDescriptor(coordinates = ROUTE.copyOf()).renderVersion())
    assertEquals(
      polygonDescriptor(holes = arrayOf(HOLE)).renderVersion(),
      polygonDescriptor(holes = arrayOf(HOLE.copyOf())).renderVersion(),
    )
    assertEquals(circleDescriptor().renderVersion(), circleDescriptor().renderVersion())
  }

  @Test
  fun `polyline points change the geometry version only`() {
    val base = polylineDescriptor().renderVersion()
    assertGeometryOnly(
      "a coordinate",
      base,
      polylineDescriptor(coordinates = arrayOf(ROUTE[0], Coordinate(52.24, 21.02))).renderVersion(),
    )
    assertGeometryOnly("the point count", base, polylineDescriptor(coordinates = arrayOf(ROUTE[0])).renderVersion())
    assertGeometryOnly(
      "an appended point",
      base,
      polylineDescriptor(coordinates = ROUTE + Coordinate(52.24, 21.02)).renderVersion(),
    )
  }

  @Test
  fun `every polyline style field changes the style version only`() {
    val base = polylineDescriptor().renderVersion()
    assertStyleOnly("strokeColor", base, polylineDescriptor(strokeColor = "#00FF00").renderVersion())
    assertStyleOnly("a cleared strokeColor", base, polylineDescriptor(strokeColor = null).renderVersion())
    assertStyleOnly("strokeWidth", base, polylineDescriptor(strokeWidth = 5.0).renderVersion())
    assertStyleOnly("zIndex", base, polylineDescriptor(zIndex = 2.0).renderVersion())
    assertStyleOnly("tappable", base, polylineDescriptor(tappable = false).renderVersion())
  }

  @Test
  fun `polygon outline and holes change the geometry version only`() {
    val base = polygonDescriptor().renderVersion()
    assertGeometryOnly(
      "a coordinate",
      base,
      polygonDescriptor(coordinates = arrayOf(ROUTE[0], Coordinate(52.24, 21.02))).renderVersion(),
    )
    assertGeometryOnly("added holes", base, polygonDescriptor(holes = arrayOf(HOLE)).renderVersion())
    assertGeometryOnly(
      "cleared holes",
      polygonDescriptor(holes = arrayOf(HOLE)).renderVersion(),
      polygonDescriptor(holes = null).renderVersion(),
    )
    assertGeometryOnly(
      "a moved hole",
      polygonDescriptor(holes = arrayOf(HOLE)).renderVersion(),
      polygonDescriptor(holes = arrayOf(arrayOf(HOLE[0], HOLE[1], Coordinate(52.2316, 21.016)))).renderVersion(),
    )
  }

  @Test
  fun `every polygon style field changes the style version only`() {
    val base = polygonDescriptor().renderVersion()
    assertStyleOnly("fillColor", base, polygonDescriptor(fillColor = "#00000000").renderVersion())
    assertStyleOnly("strokeColor", base, polygonDescriptor(strokeColor = "#000000").renderVersion())
    assertStyleOnly("strokeWidth", base, polygonDescriptor(strokeWidth = 3.0).renderVersion())
    assertStyleOnly("zIndex", base, polygonDescriptor(zIndex = 2.0).renderVersion())
    assertStyleOnly("tappable", base, polygonDescriptor(tappable = true).renderVersion())
  }

  @Test
  fun `circle center and radius change the geometry version only`() {
    val base = circleDescriptor().renderVersion()
    assertGeometryOnly("center latitude", base, circleDescriptor(center = Coordinate(52.23, 21.01)).renderVersion())
    assertGeometryOnly("center longitude", base, circleDescriptor(center = Coordinate(52.22, 21.02)).renderVersion())
    assertGeometryOnly("radius", base, circleDescriptor(radius = 900.0).renderVersion())
  }

  @Test
  fun `every circle style field changes the style version only`() {
    val base = circleDescriptor().renderVersion()
    assertStyleOnly("fillColor", base, circleDescriptor(fillColor = "#00000000").renderVersion())
    assertStyleOnly("strokeColor", base, circleDescriptor(strokeColor = "#000000").renderVersion())
    assertStyleOnly("strokeWidth", base, circleDescriptor(strokeWidth = 3.0).renderVersion())
    assertStyleOnly("tappable", base, circleDescriptor(tappable = false).renderVersion())
  }

  @Test
  fun `absent and zero valued fields are distinguishable`() {
    assertNotEquals(
      polylineDescriptor(strokeWidth = null).renderVersion(),
      polylineDescriptor(strokeWidth = 0.0).renderVersion(),
    )
    assertNotEquals(polylineDescriptor(zIndex = null).renderVersion(), polylineDescriptor(zIndex = 0.0).renderVersion())
    assertNotEquals(polygonDescriptor(zIndex = null).renderVersion(), polygonDescriptor(zIndex = 0.0).renderVersion())
    assertNotEquals(polygonDescriptor(holes = null).renderVersion(), polygonDescriptor(holes = emptyArray()).renderVersion())
    assertNotEquals(circleDescriptor(tappable = null).renderVersion(), circleDescriptor(tappable = false).renderVersion())
  }

  @Test
  fun `region equality tolerates rounding but not real changes`() {
    val region = Region(52.2297, 21.0122, 0.1, 0.2)
    assertEquals(true, region.approximatelyEquals(Region(52.2297 + 1e-9, 21.0122, 0.1, 0.2)))
    assertEquals(false, region.approximatelyEquals(Region(52.2397, 21.0122, 0.1, 0.2)))
    assertEquals(false, region.approximatelyEquals(Region(52.2297, 21.0122, 0.1, 0.3)))
  }
}
