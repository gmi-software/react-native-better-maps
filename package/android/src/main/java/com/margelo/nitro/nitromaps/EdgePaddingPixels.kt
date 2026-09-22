package com.margelo.nitro.nitromaps

/**
 * An [EdgePadding] resolved to the device pixels the Google Maps SDK counts in.
 *
 * The prop itself is density-independent, the same unit `UIEdgeInsets` uses on iOS, while
 * `GoogleMap.setPadding` and every camera update on Android work in raw pixels. Giving the
 * converted insets their own type is what keeps the two units from being mixed up again.
 */
internal data class EdgePaddingPixels(
  val top: Int,
  val right: Int,
  val bottom: Int,
  val left: Int,
) {
  val horizontal: Int get() = left + right
  val vertical: Int get() = top + bottom
  val isEmpty: Boolean get() = top == 0 && right == 0 && bottom == 0 && left == 0
}
