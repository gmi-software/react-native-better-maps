package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MarkerImageDisplaySizeTest {
  private fun image(
    width: Double? = null,
    height: Double? = null,
    scale: Double? = null,
  ) = MarkerImage("https://example.test/pin.png", width, height, scale, null)

  @Test
  fun `explicit width and height win over scale`() {
    assertEquals(111 to 183, image(width = 37.0, height = 61.0, scale = 2.0).displaySizePx(50, 82, 3f))
  }

  @Test
  fun `scale maps source pixels to dp on every density`() {
    // A 50×82 px bitmap authored for a 25×41 dp pin.
    val pin = image(scale = 2.0)
    assertEquals(25 to 41, pin.displaySizePx(50, 82, 1f))
    assertEquals(50 to 82, pin.displaySizePx(50, 82, 2f))
    assertEquals(75 to 123, pin.displaySizePx(50, 82, 3f))
  }

  @Test
  fun `only one explicit dimension falls back to scale`() {
    assertEquals(40 to 60, image(width = 40.0, scale = 3.0).displaySizePx(60, 90, 2f))
  }

  @Test
  fun `without a usable scale the source size is kept`() {
    assertNull(image().displaySizePx(50, 82, 3f))
    assertNull(image(scale = 0.0).displaySizePx(50, 82, 3f))
    assertNull(image(scale = -1.0).displaySizePx(50, 82, 3f))
    assertNull(image(scale = Double.NaN).displaySizePx(50, 82, 3f))
    assertNull(image(scale = Double.POSITIVE_INFINITY).displaySizePx(50, 82, 3f))
  }

  @Test
  fun `tiny results stay at least one pixel`() {
    assertEquals(1 to 1, image(scale = 100.0).displaySizePx(10, 10, 1f))
  }
}
