package com.margelo.nitro.nitromaps

import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.util.LruCache
import com.google.android.gms.maps.model.BitmapDescriptor
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import kotlin.math.ceil
import kotlin.math.min

/**
 * Draws the cluster badges of one map: [ClusterBadgeStyle] with the map's `clusterStyle` laid
 * over it, cached by look and label.
 */
internal class ClusterIconFactory(
  private val density: Float,
  private val markerIconFactory: MarkerIconFactory,
) {
  private val cache = object : LruCache<String, BitmapDescriptor>(128) {}
  private var appearance = ClusterBadgeAppearance.STANDARD
  private var backgroundImage: Bitmap? = null

  /** Key of the image being loaded, or null when none is. */
  private var pendingImageKey: String? = null

  /** Tells a load that finished after the style changed again apart from the current one. */
  private var loadGeneration = 0

  /** The style's image while it is not drawn yet, waiting for clustering or loading. */
  private var styleImage: MarkerImage? = null

  /**
   * A map that does not cluster draws no badge, so its image waits until clustering is on
   * instead of taking the image executor from the marker icons.
   */
  var clusteringEnabled = false
    set(value) {
      if (field == value) {
        return
      }
      field = value
      if (value) {
        loadImageIfNeeded()
      }
    }

  /** What the largest badge draws an image at, which bounds one that declares no size. */
  private val maxImageSizePx = ceil(ClusterBadgeMetrics.diameterDp(Int.MAX_VALUE) * density).toInt()

  /** Called on the main thread when the badges look different: a new style, or its image arriving. */
  var onChange: (() -> Unit)? = null

  fun setStyle(style: ClusterStyleDescriptor?) {
    val image = style?.image?.let(::badgeImage)
    val next =
      ClusterBadgeAppearance.resolve(
        backgroundColor = style?.backgroundColor,
        textColor = style?.textColor,
        borderColor = style?.borderColor,
        borderWidth = style?.borderWidth,
        backgroundImageKey = image?.let(markerIconFactory::cacheKey),
      )
    if (next == appearance) {
      return
    }

    // A new color or border keeps the image already drawn or loading, with no reload or
    // fallback flash. A load still running redraws with the latest look when it finishes.
    val keepsImage =
      next.backgroundImageKey == appearance.backgroundImageKey && (backgroundImage != null || pendingImageKey != null)
    appearance = next
    if (keepsImage) {
      onChange?.invoke()
      return
    }
    loadGeneration += 1
    backgroundImage = null
    pendingImageKey = null
    styleImage = image
    loadImageIfNeeded()
    onChange?.invoke()
  }

  private fun loadImageIfNeeded() {
    val image = styleImage ?: return
    if (!clusteringEnabled || pendingImageKey != null) {
      return
    }
    val generation = loadGeneration
    pendingImageKey = appearance.backgroundImageKey
    markerIconFactory.loadBitmap(image, maxImageSizePx) { loaded ->
      if (generation != loadGeneration) {
        return@loadBitmap
      }
      pendingImageKey = null
      styleImage = null
      if (loaded == null) {
        return@loadBitmap
      }
      backgroundImage = loaded
      onChange?.invoke()
    }
  }

  /**
   * [image] with its declared size bounded to the largest badge, which is all a badge draws.
   * One that declares no size is bounded by [maxImageSizePx] as it decodes; one that declares
   * a size that is not positive and finite is dropped for the default badge.
   */
  private fun badgeImage(image: MarkerImage): MarkerImage? {
    val width = image.width ?: return image
    val height = image.height ?: return image
    val (fittedWidth, fittedHeight) =
      ClusterBadgeStyle.fittedImageSizeDp(width, height, ClusterBadgeMetrics.diameterDp(Int.MAX_VALUE))
        ?: return null
    return image.copy(width = fittedWidth, height = fittedHeight)
  }

  fun icon(count: Int): BitmapDescriptor {
    val image = backgroundImage
    val drawn = if (image == null) appearance.withoutBackgroundImage else appearance
    val label = ClusterBadgeStyle.label(count)
    val key = "${drawn.cacheKey}:$label"
    cache.get(key)?.let { return it }

    val descriptor = BitmapDescriptorFactory.fromBitmap(draw(label, ClusterBadgeMetrics.diameterDp(count), drawn, image))
    cache.put(key, descriptor)
    return descriptor
  }

  /**
   * A badge [diameterDp] across with [ClusterBadgeStyle.SHADOW_OUTSET_DP] of room for the
   * shadow on every side, so the circle stays centered on the marker's (0.5, 0.5) anchor.
   * [backgroundImage] is drawn in place of the circle.
   */
  private fun draw(
    label: String,
    diameterDp: Float,
    appearance: ClusterBadgeAppearance,
    backgroundImage: Bitmap?,
  ): Bitmap {
    val size = ceil((diameterDp + 2 * ClusterBadgeStyle.SHADOW_OUTSET_DP) * density).toInt()
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val center = size / 2f
    val radius = diameterDp * density / 2f

    if (backgroundImage != null) {
      canvas.drawBitmap(backgroundImage, null, aspectFit(backgroundImage, center, radius), Paint(Paint.FILTER_BITMAP_FLAG))
    } else {
      drawCircle(canvas, center, radius, appearance)
    }

    val text =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = appearance.labelColor.toColorInt(DEFAULT_LABEL_COLOR)
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT_BOLD
        textSize = ClusterBadgeStyle.LABEL_FONT_SIZE_DP * density
      }
    text.textSize =
      ClusterBadgeStyle.fittedLabelFontSizeDp(text.measureText(label) / density, diameterDp, appearance.labelInsetDp) * density
    val baseline = center - (text.descent() + text.ascent()) / 2
    canvas.drawText(label, center, baseline, text)

    return bitmap
  }

  private fun drawCircle(
    canvas: Canvas,
    center: Float,
    radius: Float,
    appearance: ClusterBadgeAppearance,
  ) {
    val shadow =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = ClusterBadgeStyle.SHADOW_COLOR.toColorInt()
        maskFilter =
          BlurMaskFilter(blurMaskRadius(ClusterBadgeStyle.SHADOW_RADIUS_DP * density), BlurMaskFilter.Blur.NORMAL)
      }
    canvas.drawCircle(center, center + ClusterBadgeStyle.SHADOW_OFFSET_Y_DP * density, radius, shadow)

    // The border is the rim of a disc that the fill does not cover. A stroke drawn over the fill
    // would let the fill show through its anti-aliased outer edge.
    val disc = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = appearance.discColor.toColorInt(DEFAULT_BORDER_COLOR) }
    canvas.drawCircle(center, center, radius, disc)

    val fillRadius = radius - appearance.borderWidthDp * density
    if (fillRadius <= 0f) {
      return
    }
    val fill =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        val solidFillColor = appearance.solidFillColor
        if (solidFillColor != null) {
          color = solidFillColor.toColorInt(DEFAULT_SOLID_FILL_COLOR)
        } else {
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
      }
    canvas.drawCircle(center, center, fillRadius, fill)
  }

  /** [image] scaled to fit the square around the badge's circle, centered in it. */
  private fun aspectFit(
    image: Bitmap,
    center: Float,
    radius: Float,
  ): RectF {
    if (image.width <= 0 || image.height <= 0) {
      return RectF(center - radius, center - radius, center + radius, center + radius)
    }
    val scale = min(2 * radius / image.width, 2 * radius / image.height)
    val halfWidth = image.width * scale / 2
    val halfHeight = image.height * scale / 2
    return RectF(center - halfWidth, center - halfHeight, center + halfWidth, center + halfHeight)
  }

  /**
   * The `BlurMaskFilter` radius that blurs with a standard deviation of [sigmaPx]: the platform
   * turns a radius r into a standard deviation of 0.57735 r + 0.5 (`Blur::convertRadiusToSigma`
   * in hwui), so passing the iOS value straight through would draw a much tighter shadow.
   */
  private fun blurMaskRadius(sigmaPx: Float): Float = if (sigmaPx > 0.5f) (sigmaPx - 0.5f) / 0.57735f else 0f

  private companion object {
    // What a color that does not parse is drawn as: the default badge's color for that part.
    val DEFAULT_BORDER_COLOR = ClusterBadgeStyle.BORDER_COLOR.toColorInt()
    val DEFAULT_SOLID_FILL_COLOR = ClusterBadgeStyle.GRADIENT_BOTTOM_COLOR.toColorInt()
    val DEFAULT_LABEL_COLOR = ClusterBadgeStyle.LABEL_COLOR.toColorInt()
  }
}
