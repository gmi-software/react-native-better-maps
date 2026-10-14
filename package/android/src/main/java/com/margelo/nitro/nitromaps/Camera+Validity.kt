package com.margelo.nitro.nitromaps

/**
 * `CameraPosition.Builder.tilt` throws for a non-finite pitch, which unwinds the Fabric mount
 * transaction, and a non-finite zoom or heading is taken silently and leaves the camera reading
 * back as `NaN`.
 */
internal fun Camera.isValid(): Boolean =
  isValidCoordinate(center.latitude, center.longitude) &&
    zoom.isDrawableAsFloatOrAbsent() &&
    heading.isDrawableAsFloatOrAbsent() &&
    pitch.isFiniteOrAbsent() &&
    altitude.isFiniteOrAbsent()

/**
 * `CameraPosition` holds zoom and bearing as `Float`, so the value the SDK receives is the
 * converted one: a `Double` past `Float.MAX_VALUE` - `Double.MAX_VALUE` among them - becomes
 * `Infinity`, which the builder takes without complaint and then normalizes into a `NaN` bearing.
 * Checking after the conversion is what makes this guard match what the map is handed.
 */
private fun Double?.isDrawableAsFloatOrAbsent(): Boolean = this == null || toFloat().isFinite()

/**
 * Pitch and altitude stay `Double`: pitch is coerced into the drawable range before it is narrowed,
 * and altitude never reaches `CameraPosition` at all. An absent value is filled in from the camera
 * the map already has, so only a supplied one is checked.
 */
private fun Double?.isFiniteOrAbsent(): Boolean = this == null || isFinite()
