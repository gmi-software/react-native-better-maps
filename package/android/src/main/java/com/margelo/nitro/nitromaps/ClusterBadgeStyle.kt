package com.margelo.nitro.nitromaps

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max

/**
 * What a cluster badge looks like. iOS draws the same badge from `ClusterBadgeStyle.swift`;
 * change the two together. Sizes are in dp, and [ClusterBadgeMetrics] has the diameters.
 */
internal object ClusterBadgeStyle {
  /**
   * The fill is a vertical gradient from [GRADIENT_TOP_COLOR] at the top of the circle to
   * [GRADIENT_BOTTOM_COLOR] at the bottom.
   */
  const val GRADIENT_TOP_COLOR = "#4D9EFF"
  const val GRADIENT_BOTTOM_COLOR = "#0A84FF"

  /** The border is a ring along the circle's outer edge, inside its diameter. */
  const val BORDER_COLOR = "#FFFFFF"
  const val BORDER_WIDTH_DP = 2f

  /** Black at 28% opacity. */
  const val SHADOW_COLOR = "#00000047"

  /**
   * Shadow blur in the terms of iOS's `CALayer.shadowRadius`: about one standard deviation
   * of the Gaussian. `BlurMaskFilter` takes a different radius; see [ClusterIconFactory].
   */
  const val SHADOW_RADIUS_DP = 3f

  /** Positive moves the shadow down. */
  const val SHADOW_OFFSET_Y_DP = 1.5f

  const val LABEL_COLOR = "#FFFFFF"

  /** Size of the bold system font the count is set in. */
  const val LABEL_FONT_SIZE_DP = 13f

  /** A count too wide for the badge shrinks, down to this share of [LABEL_FONT_SIZE_DP]. */
  const val LABEL_MINIMUM_SCALE_FACTOR = 0.6f

  /** Room kept clear on either side of the count, inside the border. */
  const val LABEL_PADDING_DP = 4f

  /**
   * How far past the circle a badge bitmap extends to hold the whole shadow. At 28% opacity
   * a shadow fades below 1/255 about 2.5 standard deviations out.
   */
  val SHADOW_OUTSET_DP: Float = ceil(2.5f * SHADOW_RADIUS_DP + abs(SHADOW_OFFSET_Y_DP))

  /**
   * The count as the badge shows it: `999`, then `1.0k`, `1.5k`, `12.3k`.
   *
   * Integer arithmetic rather than `%.1f`: Java rounds the decimal value and printf the binary
   * one, so `1450` used to read `1.5k` here and `1.4k` on iOS.
   */
  fun label(count: Int): String {
    if (count < 1000) {
      return count.toString()
    }
    val tenths = (count + 50) / 100
    return "${tenths / 10}.${tenths % 10}k"
  }

  /**
   * The font size that fits a count measuring [labelWidthDp] at [LABEL_FONT_SIZE_DP] inside
   * the border of a badge [diameterDp] across.
   */
  fun fittedLabelFontSizeDp(
    labelWidthDp: Float,
    diameterDp: Float,
  ): Float {
    val availableWidth = diameterDp - 2 * (BORDER_WIDTH_DP + LABEL_PADDING_DP)
    if (labelWidthDp <= availableWidth) {
      return LABEL_FONT_SIZE_DP
    }
    return LABEL_FONT_SIZE_DP * max(LABEL_MINIMUM_SCALE_FACTOR, availableWidth / labelWidthDp)
  }
}
