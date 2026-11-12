package com.margelo.nitro.nitromaps

import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sqrt

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

/**
 * This size shrunk, keeping its aspect ratio, until neither side exceeds [maxDimension] and the
 * area stays within [maxPixels], so a large `width`/`height` or a small `scale` cannot resize a
 * sampled bitmap back past the decode limits.
 */
internal fun Pair<Int, Int>.boundedTo(
  maxDimension: Int,
  maxPixels: Long,
): Pair<Int, Int> {
  val (width, height) = this
  val pixels = width.toLong() * height
  if (maxOf(width, height) <= maxDimension && pixels <= maxPixels) {
    return this
  }
  val factor =
    minOf(
      maxDimension.toDouble() / maxOf(width, height),
      sqrt(maxPixels.toDouble() / pixels),
    )
  // The epsilon keeps a side that scales to exactly the limit from flooring one pixel short.
  return floor(width * factor + ROUNDING_EPSILON).toInt().coerceAtLeast(1) to
    floor(height * factor + ROUNDING_EPSILON).toInt().coerceAtLeast(1)
}

private const val ROUNDING_EPSILON = 1e-6
