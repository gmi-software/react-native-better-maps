package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.MapView

/**
 * Drives a [MapView] through the lifecycle callbacks the Maps SDK requires.
 *
 * The SDK only tolerates ordered transitions, so [moveTo] walks one state at a time.
 * Detaching never destroys the map — only an explicit move to
 * [MapViewLifecycleState.DESTROYED] does — because a destroyed map cannot be resumed.
 */
internal class MapViewLifecycleOwner(private val mapView: MapView) {
  private var state = MapViewLifecycleState.CREATED

  val isDestroyed: Boolean
    get() = state == MapViewLifecycleState.DESTROYED

  init {
    mapView.onCreate(null)
  }

  /** Moves the map to [target], emitting every intermediate callback along the way. */
  fun moveTo(target: MapViewLifecycleState) {
    if (isDestroyed) {
      return
    }

    if (target == MapViewLifecycleState.DESTROYED) {
      destroy()
      return
    }

    while (state.ordinal < target.ordinal) {
      stepUp()
    }

    while (state.ordinal > target.ordinal) {
      stepDown()
    }
  }

  fun onLowMemory() {
    if (isDestroyed) {
      return
    }

    mapView.onLowMemory()
  }

  private fun destroy() {
    while (state.ordinal > MapViewLifecycleState.CREATED.ordinal) {
      stepDown()
    }

    mapView.onDestroy()
    state = MapViewLifecycleState.DESTROYED
  }

  private fun stepUp() {
    when (state) {
      MapViewLifecycleState.CREATED -> {
        mapView.onStart()
        state = MapViewLifecycleState.STARTED
      }

      MapViewLifecycleState.STARTED -> {
        mapView.onResume()
        state = MapViewLifecycleState.RESUMED
      }

      MapViewLifecycleState.RESUMED,
      MapViewLifecycleState.DESTROYED,
      -> Unit
    }
  }

  private fun stepDown() {
    when (state) {
      MapViewLifecycleState.RESUMED -> {
        mapView.onPause()
        state = MapViewLifecycleState.STARTED
      }

      MapViewLifecycleState.STARTED -> {
        mapView.onStop()
        state = MapViewLifecycleState.CREATED
      }

      MapViewLifecycleState.CREATED,
      MapViewLifecycleState.DESTROYED,
      -> Unit
    }
  }
}
