package com.margelo.nitro.nitromaps

/**
 * `CameraPosition.Builder.tilt` throws for a non-finite pitch, which unwinds the Fabric mount
 * transaction, and a non-finite zoom or heading is taken silently and leaves the camera reading
 * back as `NaN`.
 */
internal fun Camera.isValid(): Boolean =
  isValidCoordinate(center.latitude, center.longitude) &&
    zoom.isFiniteOrAbsent() &&
    heading.isFiniteOrAbsent() &&
    pitch.isFiniteOrAbsent() &&
    altitude.isFiniteOrAbsent()

/** An absent value is filled in from the camera the map already has, so only a supplied one is checked. */
private fun Double?.isFiniteOrAbsent(): Boolean = this == null || isFinite()
