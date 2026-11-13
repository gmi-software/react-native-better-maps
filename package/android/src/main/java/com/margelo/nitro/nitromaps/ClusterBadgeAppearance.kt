package com.margelo.nitro.nitromaps

/**
 * What one map's cluster badges look like: its `clusterStyle` laid over [ClusterBadgeStyle].
 *
 * iOS resolves the same from `ClusterBadgeAppearance.swift`; change the two together. Colors
 * stay hex strings until they are drawn, and one that does not parse is drawn in the default
 * badge's color for that part.
 */
internal data class ClusterBadgeAppearance(
  /** A flat fill, or `null` for the gradient from [ClusterBadgeStyle.GRADIENT_TOP_COLOR]. */
  val solidFillColor: String? = null,
  val borderColor: String = ClusterBadgeStyle.BORDER_COLOR,
  val borderWidthDp: Float = ClusterBadgeStyle.BORDER_WIDTH_DP,
  val labelColor: String = ClusterBadgeStyle.LABEL_COLOR,
  /** Identifies the image drawn in place of the circle, its border and its shadow; `null` draws the circle. */
  val backgroundImageKey: String? = null,
) {
  /** The same look without its image: what shows while the image loads, or if it fails to. */
  val withoutBackgroundImage: ClusterBadgeAppearance
    get() = copy(backgroundImageKey = null)

  /**
   * The disc the fill is drawn on: the border's color, or with no border the fill's, so the
   * disc does not show along the fill's anti-aliased edge.
   */
  val discColor: String
    get() = if (borderWidthDp > 0f) borderColor else solidFillColor ?: ClusterBadgeStyle.GRADIENT_BOTTOM_COLOR

  /** How far in from the badge's edge the count must stay clear of: the border, which an image badge does not draw. */
  val labelInsetDp: Float
    get() = if (backgroundImageKey == null) borderWidthDp else 0f

  /** Tells drawn badges apart in the icon cache. */
  val cacheKey: String
    get() =
      listOf(
        // Prefixed so a solid fill named "gradient" does not share the default badge's key.
        solidFillColor?.let { "solid:$it" } ?: "gradient",
        borderColor,
        borderWidthDp.toString(),
        labelColor,
        backgroundImageKey ?: "",
      ).joinToString("|")

  companion object {
    val STANDARD = ClusterBadgeAppearance()

    fun resolve(
      backgroundColor: String?,
      textColor: String?,
      borderColor: String?,
      borderWidth: Double?,
      backgroundImageKey: String?,
    ): ClusterBadgeAppearance =
      ClusterBadgeAppearance(
        // A fill that does not parse keeps the default gradient, as on iOS.
        solidFillColor = backgroundColor?.takeIf { it.toColorIntOrNull() != null },
        borderColor = borderColor ?: ClusterBadgeStyle.BORDER_COLOR,
        borderWidthDp =
          if (borderWidth != null && borderWidth.isFinite()) {
            borderWidth.toFloat().coerceAtLeast(0f)
          } else {
            ClusterBadgeStyle.BORDER_WIDTH_DP
          },
        labelColor = textColor ?: ClusterBadgeStyle.LABEL_COLOR,
        backgroundImageKey = backgroundImageKey,
      )
  }
}
