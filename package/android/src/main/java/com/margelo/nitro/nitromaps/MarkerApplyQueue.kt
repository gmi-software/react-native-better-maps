package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import kotlin.math.cos

/** One render diff waiting to be applied over frames. */
internal class PendingMarkerApply(
  diff: MarkerRenderDiff,
  center: LatLng?,
  val animateEntering: Boolean,
  /** Entering animations left for this diff; the sink decrements it. */
  var animationBudget: Int,
) {
  private var removals: List<MarkerRenderKey> = diff.removedKeys.toList()
  val adds: ArrayDeque<ClusterElement> = ArrayDeque(sortedByDistance(diff.added, center))
  val retained: ArrayDeque<ClusterElement> = ArrayDeque(diff.retained)

  val isEmpty: Boolean
    get() = removals.isEmpty() && adds.isEmpty() && retained.isEmpty()

  /** Hands out the removals once. */
  fun takeRemovals(): List<MarkerRenderKey> {
    val taken = removals
    removals = emptyList()
    return taken
  }

  companion object {
    /** Nearest to the viewport centre first, so the visible middle fills before the edges. */
    fun sortedByDistance(elements: List<ClusterElement>, center: LatLng?): List<ClusterElement> {
      if (center == null || elements.size < 2) {
        return elements
      }
      val cosLat = cos(Math.toRadians(center.latitude))
      return elements.sortedBy { element ->
        val (latitude, longitude) = position(element)
        val dLat = latitude - center.latitude
        val dLon = (longitude - center.longitude) * cosLat
        dLat * dLat + dLon * dLon
      }
    }

    private fun position(element: ClusterElement): Pair<Double, Double> = when (element) {
      is ClusterElement.Single ->
        element.descriptor.coordinate.latitude to element.descriptor.coordinate.longitude
      is ClusterElement.Cluster -> element.position.latitude to element.position.longitude
    }
  }
}

/**
 * Applies render diffs over several frames instead of in one pass.
 *
 * Removals go out in full on the first step (cheap, and they free the screen),
 * adds go out a bounded number per frame, nearest to the centre first, and
 * retained updates fill whatever is left of the time budget. The number of
 * adds per frame adapts to the observed frame interval: a long frame halves
 * it, frames on budget grow it back, but only up to three quarters of the
 * last count that dropped a frame; that ceiling creeps up by one per good
 * frame so a one-off hitch does not pin the rate.
 *
 * A new diff replaces whatever was still pending. Diffs are computed against
 * what is actually on the map, so anything not yet applied is either in the
 * new diff again or no longer wanted.
 */
internal class MarkerApplyQueue(private val now: () -> Long = System::nanoTime) {
  interface Sink {
    fun remove(keys: List<MarkerRenderKey>)

    fun add(elements: List<ClusterElement>, pending: PendingMarkerApply)

    fun update(element: ClusterElement)
  }

  private var pending: PendingMarkerApply? = null

  var addsPerFrame: Int = INITIAL_ADDS_PER_FRAME
    private set

  /** The add count that last dropped a frame, or null before the first one. */
  var ceiling: Int? = null
    private set

  val hasWork: Boolean
    get() = pending?.isEmpty == false

  fun replace(next: PendingMarkerApply) {
    pending = if (next.isEmpty) null else next
  }

  fun clear() {
    pending = null
  }

  /** Adapts the per-frame add count to how long the last frame took. */
  fun observeFrame(intervalNanos: Long, expectedNanos: Long) {
    if (expectedNanos <= 0) {
      return
    }
    if (intervalNanos > expectedNanos + expectedNanos / 2) {
      ceiling = addsPerFrame
      addsPerFrame = maxOf(MIN_ADDS_PER_FRAME, addsPerFrame / 2)
    } else if (intervalNanos <= expectedNanos + expectedNanos / 10) {
      ceiling?.let { ceiling = it + 1 }
      val limit = ceiling?.let { maxOf(MIN_ADDS_PER_FRAME, it * 3 / 4) } ?: MAX_ADDS_PER_FRAME
      addsPerFrame = minOf(limit, addsPerFrame + addsPerFrame / 2)
    }
  }

  /** One frame's worth of work. */
  fun step(budgetNanos: Long, sink: Sink) {
    val current = pending ?: return
    val start = now()

    val removals = current.takeRemovals()
    if (removals.isNotEmpty()) {
      sink.remove(removals)
    }

    if (current.adds.isNotEmpty()) {
      val chunk = ArrayList<ClusterElement>(minOf(addsPerFrame, current.adds.size))
      while (chunk.size < addsPerFrame && current.adds.isNotEmpty()) {
        chunk.add(current.adds.removeFirst())
      }
      sink.add(chunk, current)
    }

    while (current.retained.isNotEmpty() && now() - start < budgetNanos) {
      sink.update(current.retained.removeFirst())
    }

    if (current.isEmpty) {
      pending = null
    }
  }

  companion object {
    const val INITIAL_ADDS_PER_FRAME = 32
    const val MIN_ADDS_PER_FRAME = 8
    const val MAX_ADDS_PER_FRAME = 256
  }
}
