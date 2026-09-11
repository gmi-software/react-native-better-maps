package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.CircleOptions
import com.google.android.gms.maps.model.LatLng

fun CircleDescriptor.toCircleOptions(): CircleOptions {
  val options =
    CircleOptions()
      .center(LatLng(center.latitude, center.longitude))
      .radius(radius)
      .strokeWidth((strokeWidth ?: 2.0).toFloat())
      .clickable(tappable != false)

  strokeColor?.let { options.strokeColor(it.toColorInt()) }
  fillColor?.let { options.fillColor(it.toColorInt()) }

  return options
}
