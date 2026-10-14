package com.margelo.nitro.nitromaps

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CoordinateValidityTest {
  @Test
  fun acceptsCoordinatesOnTheEdgeOfTheWorld() {
    assertTrue(Coordinate(latitude = 90.0, longitude = 180.0).isValid())
    assertTrue(Coordinate(latitude = -90.0, longitude = -180.0).isValid())
    assertTrue(Coordinate(latitude = 52.23, longitude = 21.01).isValid())
  }

  @Test
  fun rejectsNonFiniteCoordinates() {
    assertFalse(Coordinate(latitude = Double.NaN, longitude = 0.0).isValid())
    assertFalse(Coordinate(latitude = 0.0, longitude = Double.NaN).isValid())
    assertFalse(Coordinate(latitude = Double.POSITIVE_INFINITY, longitude = 0.0).isValid())
    assertFalse(Coordinate(latitude = 0.0, longitude = Double.NEGATIVE_INFINITY).isValid())
  }

  @Test
  fun rejectsCoordinatesOutsideTheWorld() {
    assertFalse(Coordinate(latitude = 1000.0, longitude = 0.0).isValid())
    assertFalse(Coordinate(latitude = 90.0001, longitude = 0.0).isValid())
    assertFalse(Coordinate(latitude = -90.0001, longitude = 0.0).isValid())
    assertFalse(Coordinate(latitude = 0.0, longitude = 180.0001).isValid())
    assertFalse(Coordinate(latitude = 0.0, longitude = -180.0001).isValid())
  }

  @Test
  fun requiresEnoughPointsForAPath() {
    val point = Coordinate(latitude = 1.0, longitude = 2.0)

    assertFalse(emptyArray<Coordinate>().isValidPath(minimumSize = 2))
    assertFalse(arrayOf(point).isValidPath(minimumSize = 2))
    assertTrue(arrayOf(point, point).isValidPath(minimumSize = 2))
    assertFalse(arrayOf(point, point).isValidPath(minimumSize = 3))
    assertTrue(arrayOf(point, point, point).isValidPath(minimumSize = 3))
  }

  @Test
  fun rejectsAPathHoldingAnUnplaceablePoint() {
    val point = Coordinate(latitude = 1.0, longitude = 2.0)
    val broken = Coordinate(latitude = Double.NaN, longitude = 2.0)

    assertFalse(arrayOf(point, broken).isValidPath(minimumSize = 2))
    assertFalse(arrayOf(broken, point, point).isValidPath(minimumSize = 3))
  }
}
