package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectionPointTest {
  @Test
  fun scalesDensityIndependentPixelsToTheNearestDevicePixel() {
    assertEquals(168, dpToPixels(56.0, 3f))
    assertEquals(28, dpToPixels(10.0, 2.75f))
    assertEquals(100, dpToPixels(33.4, 3f))
    assertEquals(-30, dpToPixels(-10.0, 3f))
  }

  @Test
  fun saturatesInsteadOfWrapping() {
    assertEquals(Int.MAX_VALUE, dpToPixels(1e12, 3f))
    assertEquals(Int.MIN_VALUE, dpToPixels(-1e12, 3f))
  }

  @Test
  fun scalesDevicePixelsBackToDensityIndependentPixels() {
    assertEquals(56.0, pixelsToDp(168, 3f), 0.0)
    assertEquals(38.095238, pixelsToDp(100, 2.625f), 1e-6)
  }

  @Test
  fun roundTripsWithinHalfADevicePixel() {
    val density = 2.625f

    for (dp in listOf(0.0, 0.1, 12.34, 187.5, 411.0)) {
      assertEquals(dp, pixelsToDp(dpToPixels(dp, density), density), 0.5 / density)
    }
  }

  @Test
  fun acceptsAnyFinitePointIncludingOneOffTheMapView() {
    assertTrue(Point(x = 0.0, y = 0.0).isValid())
    assertTrue(Point(x = -250.5, y = 1e9).isValid())
    assertFalse(Point(x = Double.NaN, y = 0.0).isValid())
    assertFalse(Point(x = 0.0, y = Double.POSITIVE_INFINITY).isValid())
  }
}
