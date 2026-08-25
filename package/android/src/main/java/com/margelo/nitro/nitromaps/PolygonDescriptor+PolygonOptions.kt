package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.PolygonOptions

fun PolygonDescriptor.toPolygonOptions(): PolygonOptions {
  val options = PolygonOptions()
    .addAll(coordinates.map { LatLng(it.latitude, it.longitude) })
    .strokeWidth((strokeWidth ?: 2.0).toFloat())
    .zIndex((zIndex ?: 0.0).toFloat())
    .clickable(tappable == true)

  holes?.forEach { hole ->
    options.addHole(hole.map { LatLng(it.latitude, it.longitude) })
  }
  strokeColor?.let { options.strokeColor(it.toColorInt()) }
  fillColor?.let { options.fillColor(it.toColorInt()) }

  return options
}
