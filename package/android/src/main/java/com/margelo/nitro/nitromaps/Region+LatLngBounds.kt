package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds

fun Region.toLatLngBounds(): LatLngBounds {
  val halfLat = latitudeDelta / 2.0
  val halfLng = longitudeDelta / 2.0
  return LatLngBounds(
    LatLng(latitude - halfLat, longitude - halfLng),
    LatLng(latitude + halfLat, longitude + halfLng),
  )
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
