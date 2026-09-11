package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.PolylineOptions

fun PolylineDescriptor.toPolylineOptions(): PolylineOptions {
  val options = PolylineOptions()
    .addAll(coordinates.map { LatLng(it.latitude, it.longitude) })
    .width((strokeWidth ?: 4.0).toFloat())
    .zIndex((zIndex ?: 0.0).toFloat())
    .clickable(tappable == true)

  strokeColor?.let { options.color(it.toColorInt()) }

  return options
}
