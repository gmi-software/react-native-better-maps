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

  @Test
  fun `a size within the limits is kept`() {
    assertEquals(150 to 246, (150 to 246).boundedTo(2048, 2048L * 2048L))
    assertEquals(2048 to 2048, (2048 to 2048).boundedTo(2048, 2048L * 2048L))
  }

  @Test
  fun `a scale-enlarged size is bounded with its aspect ratio`() {
    // A 4000×3000 source at scale 1 on density 3 asks for 12000×9000.
    val target = image(scale = 1.0).displaySizePx(4000, 3000, 3f)!!.boundedTo(2048, 2048L * 2048L)
    assertEquals(2048 to 1536, target)
  }

  @Test
  fun `the pixel limit binds when both sides fit`() {
    val (width, height) = (2000 to 2000).boundedTo(4096, 1000L * 1000L)
    assertEquals(1000 to 1000, width to height)
  }

  @Test
  fun `an extreme aspect ratio keeps at least one pixel`() {
    assertEquals(2048 to 1, (100_000 to 1).boundedTo(2048, 2048L * 2048L))
  }
}
