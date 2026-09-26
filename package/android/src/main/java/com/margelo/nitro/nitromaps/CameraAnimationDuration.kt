package com.margelo.nitro.nitromaps

/** The duration a camera animation takes when the caller passes none. */
internal const val DEFAULT_CAMERA_ANIMATION_DURATION_MS = 250.0

/**
 * The duration `MapViewRef` passes, in milliseconds, as the whole number the SDK takes. Anything
 * under one millisecond - 0, a negative value or `NaN` - comes back as 0 or less, which callers
 * treat as a jump: `GoogleMap.animateCamera` throws for a duration that is not positive.
 */
internal fun cameraAnimationDurationMs(duration: Double?): Int = (duration ?: DEFAULT_CAMERA_ANIMATION_DURATION_MS).toInt()
