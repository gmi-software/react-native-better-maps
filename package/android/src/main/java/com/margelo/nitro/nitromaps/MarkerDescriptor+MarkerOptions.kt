package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions

fun MarkerDescriptor.toMarkerOptions(): MarkerOptions =
  MarkerOptions()
    .position(LatLng(coordinate.latitude, coordinate.longitude))
    .title(title)
    .snippet(subtitle)
    .draggable(draggable == true)
    .apply {
      // Without an icon the marker is the default pin until `MarkerIconFactory` sets its image.
      if (image != null) {
        icon(placeholderMarkerIcon)
      }
    }

internal fun MarkerDescriptor.effectiveGoogleMapsAnchor(
  widthPx: Float,
  heightPx: Float,
  density: Float,
): Pair<Float, Float> {
  val anchorX = anchor?.x?.toFloat() ?: 0.5f
  val anchorY = anchor?.y?.toFloat() ?: 1.0f
  if (widthPx <= 0f || heightPx <= 0f) {
    return anchorX to anchorY
  }

  val offsetXPx = (centerOffset?.x?.toFloat() ?: 0f) * density
  val offsetYPx = (centerOffset?.y?.toFloat() ?: 0f) * density
  return (anchorX - offsetXPx / widthPx) to (anchorY - offsetYPx / heightPx)
}
