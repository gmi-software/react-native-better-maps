package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.GoogleMap

/**
 * Hands out the [GoogleMap.CancelableCallback] for each camera animation, and ends
 * whichever are still running when the map goes away.
 *
 * The SDK reports how an animation ended - `onFinish` once the camera arrives,
 * `onCancel` when a gesture or a later camera update cuts it short - but never that
 * the map it ran on was destroyed, and a promise waiting on that report would hang
 * for good.
 *
 * Main thread only, like the map it serves.
 */
internal class CameraAnimations {
  private val running = mutableListOf<Animation>()
  private var isReleased = false

  /** A callback that runs [onEnd] exactly once, however the animation ends. */
  fun callback(onEnd: () -> Unit): GoogleMap.CancelableCallback {
    val animation = Animation(onEnd)
    if (isReleased) {
      animation.end()
    } else {
      running += animation
    }
    return animation
  }

  /** Ends every animation still running, and any started from now on. */
  fun release() {
    isReleased = true
    val ended = running.toList()
    running.clear()
    for (animation in ended) {
      animation.end()
    }
  }

  private inner class Animation(
    private val onEnd: () -> Unit,
  ) : GoogleMap.CancelableCallback {
    private var hasEnded = false

    override fun onFinish() = end()

    override fun onCancel() = end()

    fun end() {
      if (hasEnded) {
        return
      }

      hasEnded = true
      running -= this
      onEnd()
    }
  }
}
