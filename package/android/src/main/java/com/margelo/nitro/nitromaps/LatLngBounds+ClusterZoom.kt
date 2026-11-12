package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import kotlin.math.max

/** Room around the outermost members, so they don't land on the map's edge. */
internal const val CLUSTER_ZOOM_PADDING_FACTOR = 1.6

/**
 * The smallest span in degrees, about a kilometre: members stacked on one coordinate spread
 * over nothing, and fitting that would zoom to the maximum.
 */
internal const val CLUSTER_ZOOM_MINIMUM_DELTA = 0.01

/** The span a cluster press fits on one axis, given how far the members spread on it. */
internal fun clusterZoomDelta(spread: Double): Double =
  max(spread * CLUSTER_ZOOM_PADDING_FACTOR, CLUSTER_ZOOM_MINIMUM_DELTA)

/**
 * The bounds a cluster press fits: the members' bounds around the same centre, each axis
 * scaled by [clusterZoomDelta]. iOS pads the cluster region the same way (`ClusterZoomSpan`),
 * so a press frames a cluster alike on every provider.
 *
 * The longitude span is left as it was if padding it would wrap the whole globe.
 */
internal fun LatLngBounds.expandedForClusterZoom(): LatLngBounds {
  // Bounds that cross the antimeridian read back as an east edge west of the west edge.
  val rawLongitudeSpread = northeast.longitude - southwest.longitude
  val longitudeSpread =
    if (rawLongitudeSpread < 0.0) rawLongitudeSpread + 360.0 else rawLongitudeSpread
  val latitudeDelta = clusterZoomDelta(northeast.latitude - southwest.latitude)
  val longitudeDelta = clusterZoomDelta(longitudeSpread)
  val centerLatitude = (southwest.latitude + northeast.latitude) / 2.0
  val centerLongitude = southwest.longitude + longitudeSpread / 2.0

  val west: Double
  val east: Double
  if (longitudeDelta < 360.0) {
    west = centerLongitude - longitudeDelta / 2.0
    east = centerLongitude + longitudeDelta / 2.0
  } else {
    west = southwest.longitude
    east = northeast.longitude
  }

  // `LatLng` clamps a latitude past ±90 and wraps a longitude past ±180 back into range.
  return LatLngBounds(
    LatLng(centerLatitude - latitudeDelta / 2.0, west),
    LatLng(centerLatitude + latitudeDelta / 2.0, east),
  )
}
