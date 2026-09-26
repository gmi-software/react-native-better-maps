package com.margelo.nitro.nitromaps

import android.graphics.Color
import com.google.android.gms.maps.model.Circle
import com.google.android.gms.maps.model.CircleOptions
import com.google.android.gms.maps.model.LatLng

fun CircleDescriptor.toCircleOptions(): CircleOptions {
  val options =
    CircleOptions()
      .center(LatLng(center.latitude, center.longitude))
      .radius(radius)
      .strokeWidth((strokeWidth ?: 2.0).toFloat())
      .clickable(tappable == true)

  strokeColor?.let { options.strokeColor(it.toColorInt()) }
  fillColor?.let { options.fillColor(it.toColorInt()) }

  return options
}

/** Moves an existing circle onto this descriptor's center and radius. */
fun CircleDescriptor.applyGeometryTo(circle: Circle) {
  circle.center = LatLng(center.latitude, center.longitude)
  circle.radius = radius
}

/** Restyles an existing circle in place, with the same defaults as [toCircleOptions]. */
fun CircleDescriptor.applyStyleTo(circle: Circle) {
  circle.strokeColor = strokeColor?.toColorInt() ?: Color.BLACK
  circle.fillColor = fillColor?.toColorInt() ?: Color.TRANSPARENT
  circle.strokeWidth = (strokeWidth ?: 2.0).toFloat()
  circle.isClickable = tappable == true
}
