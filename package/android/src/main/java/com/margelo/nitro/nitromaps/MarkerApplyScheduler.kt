package com.margelo.nitro.nitromaps

import android.view.Choreographer

/**
 * Drives a [MarkerApplyQueue] from the [Choreographer]: one step per vsync
 * while there is work, nothing scheduled when there is none.
 */
internal class MarkerApplyScheduler(
  private val queue: MarkerApplyQueue,
  private val sink: MarkerApplyQueue.Sink,
  private val expectedFrameNanos: () -> Long,
) : Choreographer.FrameCallback {
  private var isScheduled = false
  private var lastFrameNanos = 0L

  /** Replaces pending work, applies the first step right away and continues per frame. */
  fun schedule(pending: PendingMarkerApply) {
    queue.replace(pending)
    step()
    if (queue.hasWork) {
      request()
    }
  }

  fun cancel() {
    queue.clear()
    if (isScheduled) {
      Choreographer.getInstance().removeFrameCallback(this)
      isScheduled = false
    }
    lastFrameNanos = 0L
  }

  override fun doFrame(frameTimeNanos: Long) {
    isScheduled = false
    if (lastFrameNanos != 0L) {
      queue.observeFrame(frameTimeNanos - lastFrameNanos, expectedFrameNanos())
    }
    lastFrameNanos = frameTimeNanos
    step()
    if (queue.hasWork) {
      request()
    } else {
      lastFrameNanos = 0L
    }
  }

  private fun step() = traceSection("NitroMaps.applyMarkerDiff") {
    queue.step(STEP_BUDGET_NANOS, sink)
  }

  private fun request() {
    if (!isScheduled) {
      isScheduled = true
      Choreographer.getInstance().postFrameCallback(this)
    }
  }

  private companion object {
    /** Time for retained updates after the frame's adds, about a quarter of a 120 Hz frame. */
    const val STEP_BUDGET_NANOS = 2_000_000L
  }
}
