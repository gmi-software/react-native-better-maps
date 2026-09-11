package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Test

class StringColorIntTest {
  @Test
  fun parsesSupportedHexFormatsWithTrailingAlpha() {
    assertEquals(0xFFFF0000.toInt(), "#F00".toColorInt())
    assertEquals(0x88FF0000.toInt(), "#F008".toColorInt())
    assertEquals(0xFFFF0000.toInt(), "#FF0000".toColorInt())
    assertEquals(0x80FF0000.toInt(), "#FF000080".toColorInt())
  }

  @Test
  fun acceptsWhitespaceAndAnOptionalHashPrefix() {
    assertEquals(0xFF34C759.toInt(), " 34C759 ".toColorInt())
  }

  @Test
  fun returnsFallbackForMalformedInput() {
    val fallback = 0x12345678

    assertEquals(fallback, "".toColorInt(fallback))
    assertEquals(fallback, "#12".toColorInt(fallback))
    assertEquals(fallback, "#GG0000".toColorInt(fallback))
    assertEquals(fallback, "red".toColorInt(fallback))
  }
}
