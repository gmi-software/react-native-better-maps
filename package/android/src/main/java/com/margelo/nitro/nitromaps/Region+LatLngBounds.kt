package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import kotlin.math.abs

fun Region.toLatLngBounds(): LatLngBounds {
  val halfLat = latitudeDelta / 2.0
  val halfLng = longitudeDelta / 2.0
  return LatLngBounds(
    LatLng(latitude - halfLat, longitude - halfLng),
    LatLng(latitude + halfLat, longitude + halfLng),
  )
}

fun Region.approximatelyEquals(
  other: Region,
  coordinateEpsilon: Double = MapApproximateEquality.COORDINATE_EPSILON,
  spanEpsilon: Double = MapApproximateEquality.SPAN_EPSILON,
): Boolean {
  return abs(latitude - other.latitude) < coordinateEpsilon &&
    abs(longitude - other.longitude) < coordinateEpsilon &&
    abs(latitudeDelta - other.latitudeDelta) < spanEpsilon &&
    abs(longitudeDelta - other.longitudeDelta) < spanEpsilon
}

fun LatLngBounds.toRegion(): Region {
  val center = center
  return Region(
    latitude = center.latitude,
    longitude = center.longitude,
    latitudeDelta = northeast.latitude - southwest.latitude,
    longitudeDelta = northeast.longitude - southwest.longitude,
  )
}
