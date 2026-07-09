package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import kotlin.math.abs

fun Camera.toCameraPosition(current: CameraPosition? = null): CameraPosition {
  return CameraPosition.Builder()
    .target(LatLng(center.latitude, center.longitude))
    .zoom((zoom ?: current?.zoom?.toDouble() ?: 10.0).toFloat())
    .bearing((heading ?: current?.bearing?.toDouble() ?: 0.0).toFloat())
    .tilt((pitch ?: current?.tilt?.toDouble() ?: 0.0).toFloat())
    .build()
}

fun CameraPosition.toCamera(): Camera {
  return Camera(
    center = Coordinate(latitude = target.latitude, longitude = target.longitude),
    zoom = zoom.toDouble(),
    heading = bearing.toDouble(),
    pitch = tilt.toDouble(),
    altitude = null,
  )
}

fun CameraPosition.approximatelyEquals(
  other: CameraPosition,
  coordinateEpsilon: Double = MapApproximateEquality.COORDINATE_EPSILON,
  zoomEpsilon: Float = MapApproximateEquality.ZOOM_EPSILON,
  angleEpsilon: Float = MapApproximateEquality.ANGLE_EPSILON,
): Boolean {
  return abs(target.latitude - other.target.latitude) < coordinateEpsilon
    && abs(target.longitude - other.target.longitude) < coordinateEpsilon
    && abs(zoom - other.zoom) < zoomEpsilon
    && abs(bearing - other.bearing) < angleEpsilon
    && abs(tilt - other.tilt) < angleEpsilon
}
