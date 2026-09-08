package com.margelo.nitro.nitromaps

import android.graphics.Color
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Polygon
import com.google.android.gms.maps.model.PolygonOptions

fun PolygonDescriptor.toPolygonOptions(): PolygonOptions {
  val options = PolygonOptions()
    .addAll(coordinates.map { LatLng(it.latitude, it.longitude) })
    .strokeWidth((strokeWidth ?: 2.0).toFloat())
    .clickable(tappable == true)

  strokeColor?.let { options.strokeColor(it.toColorInt()) }
  fillColor?.let { options.fillColor(it.toColorInt()) }

  return options
}

/** Updates an existing polygon in place, with the same defaults as [toPolygonOptions]. */
fun PolygonDescriptor.applyTo(polygon: Polygon) {
  polygon.points = coordinates.map { LatLng(it.latitude, it.longitude) }
  polygon.strokeColor = strokeColor?.toColorInt() ?: Color.BLACK
  polygon.fillColor = fillColor?.toColorInt() ?: Color.TRANSPARENT
  polygon.strokeWidth = (strokeWidth ?: 2.0).toFloat()
  polygon.isClickable = tappable == true
}
