package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EdgePaddingPixelsTest {
  @Test
  fun scalesEveryInsetByTheScreenDensity() {
    val pixels = padding(top = 56.0, right = 52.0, bottom = 160.0, left = 12.0).toPixels(3f)

    assertEquals(168, pixels.top)
    assertEquals(156, pixels.right)
    assertEquals(480, pixels.bottom)
    assertEquals(36, pixels.left)
    assertEquals(192, pixels.horizontal)
    assertEquals(648, pixels.vertical)
  }

  @Test
  fun roundsToTheNearestPixel() {
    val pixels = padding(top = 10.0, bottom = 11.0).toPixels(2.75f)

    assertEquals(28, pixels.top)
    assertEquals(30, pixels.bottom)
  }

  @Test
  fun dropsInsetsTheMapCannotActOn() {
    val pixels =
      padding(
        top = Double.NaN,
        right = Double.POSITIVE_INFINITY,
        bottom = -40.0,
        left = 0.0,
      ).toPixels(3f)

    assertTrue(pixels.isEmpty)
  }

  @Test
  fun addsUpInsetsThatSaturatedOnTheWayIn() {
    val pixels = padding(top = 1e12, bottom = 1e12).toPixels(3f)

    assertEquals(Int.MAX_VALUE, pixels.top)
    assertEquals(Int.MAX_VALUE, pixels.bottom)
    assertEquals(2L * Int.MAX_VALUE, pixels.vertical)
  }

  private fun padding(
    top: Double = 0.0,
    right: Double = 0.0,
    bottom: Double = 0.0,
    left: Double = 0.0,
  ): EdgePadding = EdgePadding(top = top, right = right, bottom = bottom, left = left)
}
