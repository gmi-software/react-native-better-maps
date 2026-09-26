package com.margelo.nitro.nitromaps

import android.graphics.Color
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Polyline
import com.google.android.gms.maps.model.PolylineOptions

fun PolylineDescriptor.toPolylineOptions(): PolylineOptions {
  val options =
    PolylineOptions()
      .addAll(coordinates.map { LatLng(it.latitude, it.longitude) })
      .width((strokeWidth ?: 4.0).toFloat())
      .zIndex((zIndex ?: 0.0).toFloat())
      .clickable(tappable == true)

  strokeColor?.let { options.color(it.toColorInt()) }

  return options
}

/** Moves an existing polyline onto this descriptor's points. */
fun PolylineDescriptor.applyGeometryTo(polyline: Polyline) {
  polyline.points = coordinates.map { LatLng(it.latitude, it.longitude) }
}

/** Restyles an existing polyline in place, with the same defaults as [toPolylineOptions]. */
fun PolylineDescriptor.applyStyleTo(polyline: Polyline) {
  polyline.color = strokeColor?.toColorInt() ?: Color.BLACK
  polyline.width = (strokeWidth ?: 4.0).toFloat()
  polyline.zIndex = (zIndex ?: 0.0).toFloat()
  polyline.isClickable = tappable == true
}
