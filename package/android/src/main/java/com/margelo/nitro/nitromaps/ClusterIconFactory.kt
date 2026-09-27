package com.margelo.nitro.nitromaps

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import android.util.LruCache
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import kotlin.math.ceil

/** Draws the cluster badges [ClusterBadgeStyle] describes and caches them by label. */
internal class ClusterIconFactory(
  private val density: Float,
) {
  private val cache = object : LruCache<String, BitmapDescriptor>(128) {}

  fun icon(count: Int): BitmapDescriptor {
    val label = ClusterBadgeStyle.label(count)
    cache.get(label)?.let { return it }

    val descriptor = BitmapDescriptorFactory.fromBitmap(draw(label, ClusterBadgeMetrics.diameterDp(count)))
    cache.put(label, descriptor)
    return descriptor
  }

  /**
   * A badge [diameterDp] across with [ClusterBadgeStyle.SHADOW_OUTSET_DP] of room for the
   * shadow on every side, so the circle stays centered on the marker's (0.5, 0.5) anchor.
   */
  private fun draw(
    label: String,
    diameterDp: Float,
  ): Bitmap {
    val size = ceil((diameterDp + 2 * ClusterBadgeStyle.SHADOW_OUTSET_DP) * density).toInt()
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val center = size / 2f
    val radius = diameterDp * density / 2f

    val shadow =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ClusterBadgeStyle.SHADOW_COLOR.toColorInt()
        maskFilter =
          BlurMaskFilter(blurMaskRadius(ClusterBadgeStyle.SHADOW_RADIUS_DP * density), BlurMaskFilter.Blur.NORMAL)
      }
    canvas.drawCircle(center, center + ClusterBadgeStyle.SHADOW_OFFSET_Y_DP * density, radius, shadow)

    // The border is the rim of a white disc that the fill does not cover. A stroke drawn over
    // the fill would let the fill show through its anti-aliased outer edge.
    val border = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ClusterBadgeStyle.BORDER_COLOR.toColorInt() }
    canvas.drawCircle(center, center, radius, border)

    val fill =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        // Runs across the whole circle, border included, as on iOS.
        shader =
          LinearGradient(
            center,
            center - radius,
            center,
            center + radius,
            ClusterBadgeStyle.GRADIENT_TOP_COLOR.toColorInt(),
            ClusterBadgeStyle.GRADIENT_BOTTOM_COLOR.toColorInt(),
            Shader.TileMode.CLAMP,
          )
      }
    canvas.drawCircle(center, center, radius - ClusterBadgeStyle.BORDER_WIDTH_DP * density, fill)

    val text =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ClusterBadgeStyle.LABEL_COLOR.toColorInt()
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
        textSize = ClusterBadgeStyle.LABEL_FONT_SIZE_DP * density
      }
    text.textSize = ClusterBadgeStyle.fittedLabelFontSizeDp(text.measureText(label) / density, diameterDp) * density
    val baseline = center - (text.descent() + text.ascent()) / 2
    canvas.drawText(label, center, baseline, text)

    return bitmap
  }

  /**
   * The `BlurMaskFilter` radius that blurs with a standard deviation of [sigmaPx]: the platform
   * turns a radius r into a standard deviation of 0.57735 r + 0.5 (`Blur::convertRadiusToSigma`
   * in hwui), so passing the iOS value straight through would draw a much tighter shadow.
   */
  private fun blurMaskRadius(sigmaPx: Float): Float = if (sigmaPx > 0.5f) (sigmaPx - 0.5f) / 0.57735f else 0f
}
