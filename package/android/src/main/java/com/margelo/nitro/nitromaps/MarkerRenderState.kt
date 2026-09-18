package com.margelo.nitro.nitromaps

/**
 * Marker bookkeeping for [MapOverlayController], free of Android and Google Maps
 * types so its transitions can be exercised by plain JVM unit tests.
 *
 * Markers count as drawn only once a map was there to draw them on, never on the
 * mere fact that they were handed over, so markers delivered before a map exists
 * stay pending instead of being written off as already applied.
 *
 * [setMarkers], [setClusteringEnabled] and [attachMap] return whether the caller
 * has to redraw the markers.
 */
internal class MarkerRenderState {
  var descriptors: Array<MarkerDescriptor> = emptyArray()
    private set

  var clusteringEnabled: Boolean = false
    private set

  private var isMapAttached: Boolean = false
  private var fingerprint: Long = 0L

  /** Whether [descriptors] are the ones on the map right now. */
  private var isDrawn: Boolean = false

  /**
   * Whether markers are driven by the background viewport pipeline (clustering or
   * large LOD) rather than the synchronous small-dataset path.
   */
  val usesViewportPipeline: Boolean
    get() = clusteringEnabled || descriptors.size > ASYNC_THRESHOLD

  fun setMarkers(next: Array<MarkerDescriptor>?): Boolean {
    val nextDescriptors = next ?: emptyArray()
    val nextFingerprint = nextDescriptors.markersFingerprint()
    if (nextFingerprint == fingerprint && isDrawn) {
      return false
    }

    descriptors = nextDescriptors
    fingerprint = nextFingerprint
    if (!isMapAttached) {
      // Nothing reached the map, so nothing may be remembered as drawn.
      isDrawn = false
      return false
    }

    isDrawn = true
    return true
  }

  fun setClusteringEnabled(enabled: Boolean): Boolean {
    if (clusteringEnabled == enabled) {
      return false
    }

    clusteringEnabled = enabled
    return isMapAttached
  }

  /**
   * Binds a map that carries no overlays yet, so pending markers have to be drawn
   * onto it. An empty marker set needs no redraw: an empty map already shows it.
   */
  fun attachMap(): Boolean {
    isMapAttached = true
    isDrawn = true
    return descriptors.isNotEmpty()
  }

  fun detachMap() {
    isMapAttached = false
    isDrawn = false
  }

  /** Forgets the markers themselves, for when the rendered overlays are torn down. */
  fun reset() {
    descriptors = emptyArray()
    fingerprint = 0L
    isDrawn = false
  }

  private companion object {
    /** Non-clustered datasets at or below this size reconcile synchronously. */
    const val ASYNC_THRESHOLD = 500
  }
}
