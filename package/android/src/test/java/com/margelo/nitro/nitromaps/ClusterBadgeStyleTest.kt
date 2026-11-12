package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
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

  @Test
  fun fitsTheCountInsideAGivenInset() {
    // With no border, a 56 dp badge leaves 56 - 2 * 4 = 48 dp for the count.
    assertEquals(13f, ClusterBadgeStyle.fittedLabelFontSizeDp(labelWidthDp = 48f, diameterDp = 56f, insetDp = 0f))
    assertTrue(ClusterBadgeStyle.fittedLabelFontSizeDp(labelWidthDp = 48f, diameterDp = 56f) < 13f)
  }

  @Test
  fun keepsTheDefaultBadgeWhenNoStyleIsSet() {
    val appearance = resolve()

    assertEquals(ClusterBadgeAppearance.STANDARD, appearance)
    assertNull(appearance.solidFillColor)
    assertEquals(ClusterBadgeStyle.BORDER_COLOR, appearance.borderColor)
    assertEquals(ClusterBadgeStyle.BORDER_WIDTH_DP, appearance.borderWidthDp)
    assertEquals(ClusterBadgeStyle.LABEL_COLOR, appearance.labelColor)
    assertNull(appearance.backgroundImageKey)
  }

  @Test
  fun replacesTheGradientWithAFlatBackgroundColor() {
    val appearance =
      resolve(backgroundColor = "#E30613", textColor = "#000000", borderColor = "#00FF00", borderWidth = 3.0)

    assertEquals("#E30613", appearance.solidFillColor)
    assertEquals("#000000", appearance.labelColor)
    assertEquals("#00FF00", appearance.borderColor)
    assertEquals(3f, appearance.borderWidthDp)
  }

  @Test
  fun keepsTheGradientForABackgroundColorThatDoesNotParse() {
    assertNull(resolve(backgroundColor = "red").solidFillColor)
    assertEquals(ClusterBadgeAppearance.STANDARD, resolve(backgroundColor = "gradient"))
  }

  @Test
  fun keepsTheFieldsAStyleLeavesOut() {
    val appearance = resolve(textColor = "#000000")

    assertNull(appearance.solidFillColor)
    assertEquals(ClusterBadgeStyle.BORDER_COLOR, appearance.borderColor)
    assertEquals(ClusterBadgeStyle.BORDER_WIDTH_DP, appearance.borderWidthDp)
  }

  @Test
  fun clampsTheBorderWidth() {
    assertEquals(0f, resolve(borderWidth = -1.0).borderWidthDp)
    assertEquals(ClusterBadgeStyle.BORDER_WIDTH_DP, resolve(borderWidth = Double.NaN).borderWidthDp)
    assertEquals(ClusterBadgeStyle.BORDER_WIDTH_DP, resolve(borderWidth = Double.POSITIVE_INFINITY).borderWidthDp)
  }

  @Test
  fun drawsTheDiscInTheFillColorWithoutABorder() {
    assertEquals("#00FF00", resolve(borderColor = "#00FF00").discColor)
    assertEquals("#E30613", resolve(backgroundColor = "#E30613", borderWidth = 0.0).discColor)
    assertEquals(ClusterBadgeStyle.GRADIENT_BOTTOM_COLOR, resolve(borderWidth = 0.0).discColor)
  }

  @Test
  fun letsTheCountUseTheBorderOfAnImageBadge() {
    assertEquals(3f, resolve(borderWidth = 3.0).labelInsetDp)
    assertEquals(0f, resolve(borderWidth = 3.0, backgroundImageKey = "badge.png").labelInsetDp)
  }

  @Test
  fun fallsBackToTheColoredBadgeWithoutItsImage() {
    val appearance = resolve(backgroundColor = "#E30613", backgroundImageKey = "badge.png")

    assertEquals(resolve(backgroundColor = "#E30613"), appearance.withoutBackgroundImage)
  }

  @Test
  fun cachesEveryLookApart() {
    val looks =
      listOf(
        resolve(),
        resolve(backgroundColor = "#E30613"),
        resolve(textColor = "#000000"),
        resolve(borderColor = "#000000"),
        resolve(borderWidth = 0.0),
        resolve(backgroundImageKey = "badge.png"),
      )

    assertEquals(looks.size, looks.map { it.cacheKey }.toSet().size)
  }

  @Test
  fun boundsALargeDeclaredImageToTheBadge() {
    assertEquals(56.0 to 28.0, ClusterBadgeStyle.fittedImageSizeDp(448.0, 224.0, 56f))
    assertEquals(40.0 to 30.0, ClusterBadgeStyle.fittedImageSizeDp(40.0, 30.0, 56f))
  }

  private fun resolve(
    backgroundColor: String? = null,
    textColor: String? = null,
    borderColor: String? = null,
    borderWidth: Double? = null,
    backgroundImageKey: String? = null,
  ) = ClusterBadgeAppearance.resolve(backgroundColor, textColor, borderColor, borderWidth, backgroundImageKey)
}
