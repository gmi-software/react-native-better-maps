package com.margelo.nitro.nitromaps

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OverlayDescriptorValidityTest {
  @Test
  fun requiresAPlaceableCoordinateForAMarker() {
    assertTrue(marker(coordinate = point()).isValid())
    assertFalse(marker(coordinate = point(latitude = Double.NaN)).isValid())
    assertFalse(marker(coordinate = point(longitude = Double.NEGATIVE_INFINITY)).isValid())
    assertFalse(marker(coordinate = point(latitude = 90.0001)).isValid())
  }

  @Test
  fun requiresTwoPlaceablePointsForAPolyline() {
    assertFalse(polyline().isValid())
    assertFalse(polyline(point()).isValid())
    assertTrue(polyline(point(), point(latitude = 2.0)).isValid())
    assertFalse(polyline(point(), point(latitude = Double.NaN)).isValid())
  }

  @Test
  fun requiresThreePlaceablePointsForAPolygonRing() {
    assertFalse(polygon(point(), point()).isValid())
    assertTrue(polygon(point(), point(latitude = 2.0), point(longitude = 2.0)).isValid())
  }

  @Test
  fun rejectsAPolygonWhoseHoleCannotBeDrawn() {
    val ring = arrayOf(point(), point(latitude = 2.0), point(longitude = 2.0))

    assertTrue(polygon(*ring, holes = arrayOf(ring)).isValid())
    assertFalse(polygon(*ring, holes = arrayOf(arrayOf(point(), point()))).isValid())
    assertFalse(
      polygon(*ring, holes = arrayOf(arrayOf(point(), point(), point(latitude = Double.NaN))))
        .isValid(),
    )
  }

  @Test
  fun requiresANonNegativeFiniteRadiusForACircle() {
    assertTrue(circle(radius = 0.0).isValid())
    assertTrue(circle(radius = 500.0).isValid())
    assertFalse(circle(radius = -1.0).isValid())
    assertFalse(circle(radius = Double.NaN).isValid())
    assertFalse(circle(center = point(latitude = Double.NaN)).isValid())
  }

  private fun point(
    latitude: Double = 1.0,
    longitude: Double = 1.0,
  ): Coordinate = Coordinate(latitude = latitude, longitude = longitude)

  private fun polyline(vararg coordinates: Coordinate): PolylineDescriptor =
    PolylineDescriptor(
      id = "polyline-1",
      coordinates = arrayOf(*coordinates),
      strokeColor = null,
      strokeWidth = null,
      zIndex = null,
      tappable = null,
    )

  private fun polygon(
    vararg coordinates: Coordinate,
    holes: Array<Array<Coordinate>>? = null,
  ): PolygonDescriptor =
    PolygonDescriptor(
      id = "polygon-1",
      coordinates = arrayOf(*coordinates),
      holes = holes,
      fillColor = null,
      strokeColor = null,
      strokeWidth = null,
      zIndex = null,
      tappable = null,
    )

  private fun circle(
    center: Coordinate = point(),
    radius: Double = 100.0,
  ): CircleDescriptor =
    CircleDescriptor(
      id = "circle-1",
      center = center,
      radius = radius,
      fillColor = null,
      strokeColor = null,
      strokeWidth = null,
      tappable = null,
    )
}
