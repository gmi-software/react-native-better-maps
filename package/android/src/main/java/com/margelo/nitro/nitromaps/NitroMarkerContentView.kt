package com.margelo.nitro.nitromaps

import android.content.Context
import android.view.ViewGroup
import kotlin.math.roundToInt

/**
 * The host of a live `MarkerView`. Fabric mounts the marker's JSX in it and lays it out; the map
 * only moves it, by translation, to where the camera projects its coordinate.
 */
class NitroMarkerContentView(
  context: Context,
) : ViewGroup(context) {
  var coordinate: Coordinate? = null
  var anchor: MarkerAnchor? = null

  private var publishedTag = NO_ID
  private var publishedX = Float.NaN
  private var publishedY = Float.NaN

  init {
    clipChildren = true
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    // Fabric resized the host; its anchor point moved with it.
    updatePosition((parent as? NitroMapContainerView)?.makeProjection?.invoke())
  }

  override fun onDetachedFromWindow() {
    clearPublishedProjection()
    super.onDetachedFromWindow()
  }

  /**
   * Places the host for [projection], the camera's current one. A marker off screen is made
   * invisible, which also takes it out of drawing and of touch handling.
   */
  internal fun updatePosition(projection: MarkerProjection?) {
    val map = parent as? NitroMapContainerView ?: return
    val coordinate = coordinate
    val point = if (coordinate == null) null else projection?.invoke(coordinate)
    if (point == null || width <= 0 || height <= 0) {
      setOnScreen(false)
      return
    }

    // Whole pixels: a fractional offset resamples the marker and blurs its text.
    val x = (point.x - width * (anchor?.x ?: 0.5)).roundToInt()
    val y = (point.y - height * (anchor?.y ?: 1.0)).roundToInt()
    val isOnScreen = x < map.width && y < map.height && x + width > 0 && y + height > 0
    setOnScreen(isOnScreen)
    if (!isOnScreen) {
      return
    }

    val translateX = (x - left).toFloat()
    val translateY = (y - top).toFloat()
    if (translationX != translateX) translationX = translateX
    if (translationY != translateY) translationY = translateY
    publish(translateX, translateY)
  }

  private fun setOnScreen(isOnScreen: Boolean) {
    val nextVisibility = if (isOnScreen) VISIBLE else INVISIBLE
    if (visibility != nextVisibility) {
      visibility = nextVisibility
    }
    if (!isOnScreen) {
      clearPublishedProjection()
    }
  }

  /**
   * Hands the translation, in dp, to the shadow node, so `measure()` reports the marker where it is
   * drawn. Written only when it changed.
   */
  private fun publish(
    translateX: Float,
    translateY: Float,
  ) {
    val tag = id
    if (tag <= 0 || (tag == publishedTag && translateX == publishedX && translateY == publishedY)) {
      return
    }
    if (publishedTag > 0 && publishedTag != tag) {
      MarkerProjectionRegistry.clear(publishedTag)
    }
    val density = resources.displayMetrics.density
    MarkerProjectionRegistry.publish(tag, translateX / density, translateY / density)
    publishedTag = tag
    publishedX = translateX
    publishedY = translateY
  }

  private fun clearPublishedProjection() {
    if (publishedTag <= 0) {
      return
    }
    MarkerProjectionRegistry.clear(publishedTag)
    publishedTag = NO_ID
    publishedX = Float.NaN
    publishedY = Float.NaN
  }
}
