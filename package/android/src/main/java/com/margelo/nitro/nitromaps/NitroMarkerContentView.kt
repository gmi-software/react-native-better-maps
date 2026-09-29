package com.margelo.nitro.nitromaps

import android.content.Context
import android.view.View
import android.view.ViewGroup

/** Fabric keeps ownership and layout of children; the outer host translates. */
class NitroMarkerContentView(context: Context) : ViewGroup(context) {
  var coordinate: Coordinate? = null
  var anchor: MarkerAnchor? = null
  private var publishedTag = View.NO_ID
  private var publishedX = Float.NaN
  private var publishedY = Float.NaN

  init { clipChildren = true }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    updatePosition()
  }

  override fun onDetachedFromWindow() {
    clearProjection()
    super.onDetachedFromWindow()
  }

  private fun clearProjection() {
    if (publishedTag > 0) MarkerProjectionRegistry.clear(publishedTag)
    publishedTag = View.NO_ID
    publishedX = Float.NaN
    publishedY = Float.NaN
  }

  fun updatePosition() {
    val map = parent as? NitroMapContainerView ?: return
    val coordinate = coordinate
    val point = coordinate?.let { map.projectCoordinate?.invoke(it) }
    if (point == null || width <= 0 || height <= 0) {
      visibility = INVISIBLE
      clearProjection()
      return
    }
    val x = point.x - width * (anchor?.x ?: 0.5)
    val y = point.y - height * (anchor?.y ?: 1.0)
    val visible = x.isFinite() && y.isFinite() &&
      x < map.width && y < map.height && x + width > 0 && y + height > 0
    visibility = if (visible) VISIBLE else INVISIBLE
    if (visible) {
      val nextX = (x - left).toFloat()
      val nextY = (y - top).toFloat()
      if (translationX != nextX) translationX = nextX
      if (translationY != nextY) translationY = nextY
      val density = resources.displayMetrics.density
      val tag = id
      if (tag > 0 && (tag != publishedTag || nextX != publishedX || nextY != publishedY)) {
        if (publishedTag > 0 && publishedTag != tag) MarkerProjectionRegistry.clear(publishedTag)
        MarkerProjectionRegistry.publish(tag, nextX / density, nextY / density)
        publishedTag = tag
        publishedX = nextX
        publishedY = nextY
      }
    } else {
      clearProjection()
    }
  }
}
