package com.margelo.nitro.nitromaps

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShapeTappableTest {
  @Test
  fun leavesEveryShapeUntappableWhenTappableIsAbsent() {
    assertFalse(polyline(tappable = null).toPolylineOptions().isClickable)
    assertFalse(polygon(tappable = null).toPolygonOptions().isClickable)
    assertFalse(circle(tappable = null).toCircleOptions().isClickable)
  }

  @Test
  fun makesAShapeTappableWhenAskedTo() {
    assertTrue(polyline(tappable = true).toPolylineOptions().isClickable)
    assertTrue(polygon(tappable = true).toPolygonOptions().isClickable)
    assertTrue(circle(tappable = true).toCircleOptions().isClickable)
  }

  @Test
  fun keepsAShapeUntappableWhenAskedTo() {
    assertFalse(polyline(tappable = false).toPolylineOptions().isClickable)
    assertFalse(polygon(tappable = false).toPolygonOptions().isClickable)
    assertFalse(circle(tappable = false).toCircleOptions().isClickable)
  }

  private fun point(latitude: Double): Coordinate = Coordinate(latitude = latitude, longitude = 21.0)

  private fun polyline(tappable: Boolean?): PolylineDescriptor =
    PolylineDescriptor(
      id = "polyline-1",
      coordinates = arrayOf(point(52.0), point(52.1)),
      strokeColor = null,
      strokeWidth = null,
      zIndex = null,
      tappable = tappable,
    )

  private fun polygon(tappable: Boolean?): PolygonDescriptor =
    PolygonDescriptor(
      id = "polygon-1",
      coordinates = arrayOf(point(52.0), point(52.1), point(52.2)),
      holes = null,
      fillColor = null,
      strokeColor = null,
      strokeWidth = null,
      zIndex = null,
      tappable = tappable,
    )

  private fun circle(tappable: Boolean?): CircleDescriptor =
    CircleDescriptor(
      id = "circle-1",
      center = point(52.0),
      radius = 100.0,
      fillColor = null,
      strokeColor = null,
      strokeWidth = null,
      tappable = tappable,
    )
}
