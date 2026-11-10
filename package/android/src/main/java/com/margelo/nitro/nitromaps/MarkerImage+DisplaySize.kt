package com.margelo.nitro.nitromaps

import kotlin.math.roundToInt

/**
 * The size, in pixels, this image is drawn at when its source bitmap is
 * [sourceWidthPx]×[sourceHeightPx]. An explicit `width` and `height` win; otherwise a usable
 * `scale` maps the source pixels to dp. `null` keeps the source size. Mirrors
 * `MarkerImageDisplaySize.swift`.
 */
internal fun MarkerImage.displaySizePx(
  sourceWidthPx: Int,
  sourceHeightPx: Int,
  density: Float,
): Pair<Int, Int>? {
  val widthDp = width
  val heightDp = height
  if (widthDp != null && heightDp != null && widthDp > 0 && heightDp > 0) {
    return (widthDp * density).toInt().coerceAtLeast(1) to (heightDp * density).toInt().coerceAtLeast(1)
  }

  val scale = scale?.takeIf { it.isFinite() && it > 0 } ?: return null
  val pxPerSourcePx = density / scale
  return (sourceWidthPx * pxPerSourcePx).roundToInt().coerceAtLeast(1) to
    (sourceHeightPx * pxPerSourcePx).roundToInt().coerceAtLeast(1)
}
