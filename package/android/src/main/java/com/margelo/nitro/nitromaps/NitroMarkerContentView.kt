package com.margelo.nitro.nitromaps

import android.content.Context
import android.view.ViewGroup

/** Fabric keeps ownership and layout of children; the outer host translates. */
class NitroMarkerContentView(context: Context) : ViewGroup(context) {
  var coordinate: Coordinate? = null
  var anchor: MarkerAnchor? = null

  init { clipChildren = true }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    updatePosition()
  }

  fun updatePosition() {
    val map = parent as? NitroMapContainerView ?: return
    val coordinate = coordinate
    val point = coordinate?.let { map.projectCoordinate?.invoke(it) }
    if (point == null || width <= 0 || height <= 0) {
      visibility = INVISIBLE
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
    }
  }
}
