package com.margelo.nitro.nitromaps

import android.graphics.Color
import com.google.android.gms.maps.model.Circle
import com.google.android.gms.maps.model.CircleOptions
import com.google.android.gms.maps.model.LatLng

fun CircleDescriptor.toCircleOptions(): CircleOptions {
  val options = CircleOptions()
    .center(LatLng(center.latitude, center.longitude))
    .radius(radius)
    .strokeWidth((strokeWidth ?: 2.0).toFloat())
    .clickable(tappable != false)

  strokeColor?.let { options.strokeColor(it.toColorInt()) }
  fillColor?.let { options.fillColor(it.toColorInt()) }

  return options
}

/** Updates an existing circle in place, with the same defaults as [toCircleOptions]. */
fun CircleDescriptor.applyTo(circle: Circle) {
  circle.center = LatLng(center.latitude, center.longitude)
  circle.radius = radius
  circle.strokeColor = strokeColor?.toColorInt() ?: Color.BLACK
  circle.fillColor = fillColor?.toColorInt() ?: Color.TRANSPARENT
  circle.strokeWidth = (strokeWidth ?: 2.0).toFloat()
  circle.isClickable = tappable != false
}
