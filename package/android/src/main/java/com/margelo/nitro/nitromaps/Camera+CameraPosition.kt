package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import kotlin.math.abs

fun Camera.toCameraPosition(current: CameraPosition? = null): CameraPosition {
  return CameraPosition
    .Builder()
    .target(LatLng(center.latitude, center.longitude))
    .zoom((zoom ?: current?.zoom?.toDouble() ?: 10.0).toFloat())
    .bearing((heading ?: current?.bearing?.toDouble() ?: 0.0).toFloat())
    .tilt(drawableTilt(pitch ?: current?.tilt?.toDouble() ?: 0.0))
    .build()
}

/**
 * `CameraPosition.Builder.tilt` throws for anything outside 0..90, and that throw would unwind the
 * Fabric mount transaction, so a pitch past the limit is pulled back to it. MapKit flattens such a
 * camera rather than refusing it, which is the behaviour this matches. A non-finite pitch never
 * reaches here - `Camera.isValid()` drops the whole camera first - but it is handled so this stays
 * safe on its own.
 */
private fun drawableTilt(pitch: Double): Float =
  if (pitch.isFinite()) pitch.coerceIn(MINIMUM_TILT, MAXIMUM_TILT).toFloat() else MINIMUM_TILT.toFloat()

private const val MINIMUM_TILT = 0.0
private const val MAXIMUM_TILT = 90.0

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
  return abs(target.latitude - other.target.latitude) < coordinateEpsilon &&
    abs(target.longitude - other.target.longitude) < coordinateEpsilon &&
    abs(zoom - other.zoom) < zoomEpsilon &&
    abs(bearing - other.bearing) < angleEpsilon &&
    abs(tilt - other.tilt) < angleEpsilon
}
