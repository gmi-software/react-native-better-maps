package com.margelo.nitro.nitromaps

import kotlin.math.roundToInt

/**
 * Scales the density-independent insets the prop is documented in to device pixels.
 *
 * An inset the map cannot act on — `NaN`, infinite or negative — collapses to none, so a
 * bad number leaves the padding alone instead of reaching `setPadding` or a camera update.
 */
internal fun EdgePadding.toPixels(density: Float): EdgePaddingPixels =
  EdgePaddingPixels(
    top = insetPixels(top, density),
    right = insetPixels(right, density),
    bottom = insetPixels(bottom, density),
    left = insetPixels(left, density),
  )

private fun insetPixels(
  inset: Double,
  density: Float,
): Int {
  if (!inset.isFinite() || inset <= 0.0) {
    return 0
  }

  return (inset * density).roundToInt()
}
