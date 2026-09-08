package com.margelo.nitro.nitromaps

import android.graphics.Color
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Polyline
import com.google.android.gms.maps.model.PolylineOptions

fun PolylineDescriptor.toPolylineOptions(): PolylineOptions {
  val options = PolylineOptions()
    .addAll(coordinates.map { LatLng(it.latitude, it.longitude) })
    .width((strokeWidth ?: 4.0).toFloat())
    .clickable(tappable == true)

  strokeColor?.let { options.color(it.toColorInt()) }

  return options
}

/** Updates an existing polyline in place, with the same defaults as [toPolylineOptions]. */
fun PolylineDescriptor.applyTo(polyline: Polyline) {
  polyline.points = coordinates.map { LatLng(it.latitude, it.longitude) }
  polyline.color = strokeColor?.toColorInt() ?: Color.BLACK
  polyline.width = (strokeWidth ?: 4.0).toFloat()
  polyline.isClickable = tappable == true
}
