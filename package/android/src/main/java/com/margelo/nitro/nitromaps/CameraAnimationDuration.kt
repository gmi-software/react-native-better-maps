package com.margelo.nitro.nitromaps

/** The duration a camera animation takes when the caller passes none. */
internal const val DEFAULT_CAMERA_ANIMATION_DURATION_MS = 250.0

/**
 * The duration `MapViewRef` passes, in milliseconds, as the whole number the SDK takes. Anything
 * under one millisecond - 0, a negative value or `NaN` - and infinity come back as 0 or less,
 * which callers treat as a jump: `GoogleMap.animateCamera` throws for a duration that is not
 * positive. The Swift `cameraAnimationSeconds(fromMilliseconds:)` does the same for iOS.
 */
internal fun cameraAnimationDurationMs(duration: Double?): Int {
  val durationMs = duration ?: DEFAULT_CAMERA_ANIMATION_DURATION_MS
  return if (durationMs.isFinite()) durationMs.toInt() else 0
}
