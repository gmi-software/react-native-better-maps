package expo.modules.framestats

import android.view.Choreographer
import android.view.Display

/**
 * Records main-thread frame intervals with a [Choreographer] callback.
 *
 * The callback runs once per vsync while the main thread is free, so the gap
 * between two callbacks is the frame interval the user experienced: a blocked
 * main thread shows up as one long interval. The display's refresh interval
 * is captured per frame because adaptive displays change rate on their own.
 */
internal class FrameRecorder(
  private val displayProvider: () -> Display?,
) : Choreographer.FrameCallback {
  private val intervalsMs = ArrayList<Double>(4096)
  private val expectedMs = ArrayList<Double>(4096)
  private var lastFrameNanos = 0L
  private var startedAtNanos = 0L
  private var running = false

  fun start() {
    running = true
    startedAtNanos = System.nanoTime()
    lastFrameNanos = 0L
    Choreographer.getInstance().postFrameCallback(this)
  }

  override fun doFrame(frameTimeNanos: Long) {
    if (!running) {
      return
    }
    if (lastFrameNanos != 0L) {
      intervalsMs.add((frameTimeNanos - lastFrameNanos) / 1_000_000.0)
      expectedMs.add(1000.0 / (displayProvider()?.refreshRate ?: 60f))
    }
    lastFrameNanos = frameTimeNanos
    Choreographer.getInstance().postFrameCallback(this)
  }

  fun stop(): Map<String, Any> {
    running = false
    Choreographer.getInstance().removeFrameCallback(this)
    return mapOf(
      "intervalsMs" to intervalsMs.toDoubleArray(),
      "expectedMs" to expectedMs.toDoubleArray(),
      "durationMs" to (System.nanoTime() - startedAtNanos) / 1_000_000.0,
      "refreshRateHz" to (displayProvider()?.refreshRate ?: 60f).toDouble(),
    )
  }

  companion object {
    fun emptyRecording(display: Display?): Map<String, Any> = mapOf(
      "intervalsMs" to DoubleArray(0),
      "expectedMs" to DoubleArray(0),
      "durationMs" to 0.0,
      "refreshRateHz" to (display?.refreshRate ?: 60f).toDouble(),
    )
  }
}
