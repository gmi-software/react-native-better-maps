package com.margelo.nitro.nitromaps

/** A polyline needs two placeable points before `GoogleMap.addPolyline` accepts it. */
internal fun PolylineDescriptor.isValid(): Boolean = coordinates.isValidPath(MINIMUM_POLYLINE_SIZE)

/** Every hole is passed to `PolygonOptions.addHole` as a ring of its own, so each one has to hold up too. */
internal fun PolygonDescriptor.isValid(): Boolean {
  if (!coordinates.isValidPath(MINIMUM_RING_SIZE)) {
    return false
  }

  val rings = holes ?: return true
  return rings.all { ring -> ring.isValidPath(MINIMUM_RING_SIZE) }
}

/** `GoogleMap.addCircle` throws on a negative radius and on an unplaceable center. */
internal fun CircleDescriptor.isValid(): Boolean = center.isValid() && radius.isFinite() && radius >= 0.0

private const val MINIMUM_POLYLINE_SIZE = 2
private const val MINIMUM_RING_SIZE = 3
