package com.margelo.nitro.nitromaps

/**
 * Render versions for shape overlay descriptors.
 *
 * Overlay controllers keep the version of every shape they have shown so a
 * descriptor that is sent again unchanged costs one hash instead of a native
 * remove-and-add, and a changed one is updated in place.
 */
private fun Array<Coordinate>.geometrySignature(): Long {
  var hash = size.toLong()
  for (coordinate in this) {
    hash = 1099511628211L * hash + java.lang.Double.doubleToLongBits(coordinate.latitude)
    hash = 1099511628211L * hash + java.lang.Double.doubleToLongBits(coordinate.longitude)
  }
  return hash
}

internal fun PolylineDescriptor.renderVersion(): Long =
  renderSignature(
    "polyline",
    id,
    coordinates.geometrySignature(),
    strokeColor,
    strokeWidth,
    tappable,
  )

internal fun PolygonDescriptor.renderVersion(): Long =
  renderSignature(
    "polygon",
    id,
    coordinates.geometrySignature(),
    fillColor,
    strokeColor,
    strokeWidth,
    tappable,
  )

internal fun CircleDescriptor.renderVersion(): Long =
  renderSignature(
    "circle",
    id,
    center.latitude,
    center.longitude,
    radius,
    fillColor,
    strokeColor,
    strokeWidth,
    tappable,
  )
