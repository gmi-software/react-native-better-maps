package com.margelo.nitro.nitromaps

import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.Priority

// What the Google Maps SDK's own location source asks for, as Google Play services reports it.
private const val UPDATE_INTERVAL_MS = 5_000L
private const val MIN_UPDATE_INTERVAL_MS = 16L

/**
 * The priority the my-location layer asks for: GPS needs precise location, and approximate
 * location only ever gets balanced accuracy. `null` when neither permission is held.
 */
internal fun userLocationPriority(
  hasFineLocation: Boolean,
  hasCoarseLocation: Boolean,
): Int? =
  when {
    hasFineLocation -> Priority.PRIORITY_HIGH_ACCURACY
    hasCoarseLocation -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
    else -> null
  }

internal fun userLocationRequest(priority: Int): LocationRequest =
  LocationRequest
    .Builder(priority, UPDATE_INTERVAL_MS)
    .setMinUpdateIntervalMillis(MIN_UPDATE_INTERVAL_MS)
    .setWaitForAccurateLocation(true)
    .build()
