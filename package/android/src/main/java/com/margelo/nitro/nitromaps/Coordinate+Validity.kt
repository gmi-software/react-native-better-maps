package com.margelo.nitro.nitromaps

/** Google Maps throws on a coordinate it cannot place, which unwinds the Fabric mount transaction. */
internal fun Coordinate.isValid(): Boolean = isValidCoordinate(latitude, longitude)

/** Scalar form, so a `Region` can check its center without building a `Coordinate` for it. */
internal fun isValidCoordinate(
  latitude: Double,
  longitude: Double,
): Boolean =
  latitude.isFinite() &&
    latitude >= -90.0 &&
    latitude <= 90.0 &&
    longitude.isFinite() &&
    longitude >= -180.0 &&
    longitude <= 180.0

/** Minimum size is 2 for a polyline and 3 for a polygon ring. */
internal fun Array<Coordinate>.isValidPath(minimumSize: Int): Boolean = size >= minimumSize && all { it.isValid() }
