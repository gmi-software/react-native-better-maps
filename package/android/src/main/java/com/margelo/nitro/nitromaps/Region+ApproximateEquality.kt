package com.margelo.nitro.nitromaps

import kotlin.math.abs

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
