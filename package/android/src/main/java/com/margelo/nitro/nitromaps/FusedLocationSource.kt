package com.margelo.nitro.nitromaps

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import android.util.Log
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.LocationSource

/**
 * Feeds the my-location layer from the fused location provider.
 *
 * The Google Maps SDK's own source settles on a request priority when the map is created and
 * never revisits it, so a map created before the user granted location access keeps asking for
 * balanced power accuracy and its dot never uses GPS. This source makes the same request, but
 * takes the priority from the permission held when it asks, and asks again through
 * [refreshPriority] once that permission changes.
 */
internal class FusedLocationSource(
  private val context: Context,
) : LocationSource {
  private val client = LocationServices.getFusedLocationProviderClient(context)
  private var listener: LocationSource.OnLocationChangedListener? = null
  private var requestedPriority: Int? = null

  private val callback =
    object : LocationCallback() {
      override fun onLocationResult(result: LocationResult) {
        result.lastLocation?.let { listener?.onLocationChanged(it) }
      }
    }

  override fun activate(listener: LocationSource.OnLocationChangedListener) {
    this.listener = listener
    requestUpdates()
  }

  override fun deactivate() {
    client.removeLocationUpdates(callback)
    listener = null
    requestedPriority = null
  }

  /**
   * Asks again if the location permission changed since the running request was made, or if
   * that request failed. The Google Maps SDK never reactivates its source on resume, so nothing
   * else would.
   */
  fun refreshPriority() {
    if (listener != null && currentPriority() != requestedPriority) {
      requestUpdates()
    }
  }

  @SuppressLint("MissingPermission")
  private fun requestUpdates() {
    val priority = currentPriority() ?: return
    // A request made with the same callback replaces the previous one.
    client
      .requestLocationUpdates(userLocationRequest(priority), callback, Looper.getMainLooper())
      .addOnFailureListener { error ->
        Log.w(NITRO_MAPS_LOG_TAG, "Failed to request location updates.", error)
        // Unless a newer request replaced it, let the next refreshPriority() ask again.
        if (requestedPriority == priority) {
          requestedPriority = null
        }
      }
    requestedPriority = priority
  }

  private fun currentPriority(): Int? =
    userLocationPriority(
      hasFineLocation = context.hasFineLocationPermission,
      hasCoarseLocation = context.hasCoarseLocationPermission,
    )
}
