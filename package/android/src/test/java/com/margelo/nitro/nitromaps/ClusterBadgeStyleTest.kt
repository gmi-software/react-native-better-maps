package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// ClusterBadgeStyleTests.swift checks the same cases on iOS.
class ClusterBadgeStyleTest {
  @Test
  fun showsCountsBelowOneThousandInFull() {
    assertEquals("2", ClusterBadgeStyle.label(2))
    assertEquals("999", ClusterBadgeStyle.label(999))
  }

  @Test
  fun showsLargerCountsInThousandsToOneDecimal() {
    assertEquals("1.0k", ClusterBadgeStyle.label(1000))
    assertEquals("1.0k", ClusterBadgeStyle.label(1049))
    assertEquals("1.4k", ClusterBadgeStyle.label(1400))
    assertEquals("12.3k", ClusterBadgeStyle.label(12_345))
    assertEquals("1000.0k", ClusterBadgeStyle.label(999_950))
  }

  @Test
  fun roundsHalfwayCountsUpLikeIos() {
    assertEquals("1.5k", ClusterBadgeStyle.label(1450))
    assertEquals("1.2k", ClusterBadgeStyle.label(1150))
    assertEquals("12.4k", ClusterBadgeStyle.label(12_350))
  }

  @Test
  fun keepsTheFontSizeOfACountThatFits() {
    assertEquals(13f, ClusterBadgeStyle.fittedLabelFontSizeDp(labelWidthDp = 27f, diameterDp = 56f))
    // A 56 dp badge leaves 56 - 2 * (2 + 4) = 44 dp for the count.
    assertEquals(13f, ClusterBadgeStyle.fittedLabelFontSizeDp(labelWidthDp = 44f, diameterDp = 56f))
  }

  @Test
  fun shrinksACountTooWideForTheBadge() {
    assertEquals(11f, ClusterBadgeStyle.fittedLabelFontSizeDp(labelWidthDp = 52f, diameterDp = 56f), 0.0001f)
  }

  @Test
  fun stopsShrinkingAtTheMinimumScale() {
    assertEquals(13f * 0.6f, ClusterBadgeStyle.fittedLabelFontSizeDp(labelWidthDp = 500f, diameterDp = 56f), 0.0001f)
  }

  @Test
  fun leavesRoomForTheWholeShadow() {
    val reach = 2.5f * ClusterBadgeStyle.SHADOW_RADIUS_DP + ClusterBadgeStyle.SHADOW_OFFSET_Y_DP

    assertTrue(ClusterBadgeStyle.SHADOW_OUTSET_DP >= reach)
  }

  @Test
  fun definesEveryColorAsValidHex() {
    val colors =
      listOf(
        ClusterBadgeStyle.GRADIENT_TOP_COLOR,
        ClusterBadgeStyle.GRADIENT_BOTTOM_COLOR,
        ClusterBadgeStyle.BORDER_COLOR,
        ClusterBadgeStyle.SHADOW_COLOR,
        ClusterBadgeStyle.LABEL_COLOR,
      )
    // No valid color here is fully transparent, so this cannot be a real result.
    val invalid = 0x00123456

    for (color in colors) {
      assertNotEquals(color, invalid, color.toColorInt(invalid))
    }
    assertEquals(0x47, ClusterBadgeStyle.SHADOW_COLOR.toColorInt() ushr 24)
  }
}
