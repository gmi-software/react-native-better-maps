package com.margelo.nitro.nitromaps

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import java.util.Locale

/** Builds and caches circular cluster badge icons (gradient + soft shadow). */
internal class ClusterIconFactory(
  private val density: Float,
) {
  private val cache = HashMap<String, BitmapDescriptor>()

  fun icon(count: Int): BitmapDescriptor {
    val label = formatCount(count)
    cache[label]?.let { return it }

    val diameter = (ClusterBadgeMetrics.diameterDp(count) * density).coerceAtLeast(1f)
    val pad = 4f * density
    val size = (diameter + pad * 2).toInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val center = size / 2f
    val radius = diameter / 2f

    val shadow =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(70, 0, 0, 0)
        maskFilter = android.graphics.BlurMaskFilter(2.5f * density, android.graphics.BlurMaskFilter.Blur.NORMAL)
      }
    canvas.drawCircle(center, center + 1f * density, radius, shadow)

    val fill =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        shader =
          RadialGradient(
            center,
            center - radius * 0.3f,
            radius,
            intArrayOf(Color.parseColor("#4D9EFF"), Color.parseColor("#0A84FF")),
            null,
            Shader.TileMode.CLAMP,
          )
      }
    canvas.drawCircle(center, center, radius, fill)

    val border =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 2f * density
        color = Color.WHITE
      }
    canvas.drawCircle(center, center, radius - density, border)

    val text =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        textSize = 13f * density
        isFakeBoldText = true
      }
    val baseline = center - (text.descent() + text.ascent()) / 2
    canvas.drawText(label, center, baseline, text)

    val descriptor = BitmapDescriptorFactory.fromBitmap(bitmap)
    cache[label] = descriptor
    return descriptor
  }

  private fun formatCount(count: Int): String {
    return if (count >= 1000) String.format(Locale.US, "%.1fk", count / 1000.0) else count.toString()
  }
}
