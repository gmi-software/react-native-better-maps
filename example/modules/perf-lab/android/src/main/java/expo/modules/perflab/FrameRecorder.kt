package expo.modules.perflab

import android.app.Activity
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.view.Choreographer
import android.view.Display
import android.view.FrameMetrics
import android.view.Window

/**
 * Records main-thread frame intervals with a [Choreographer] callback and,
 * when an activity window is available, per-frame [FrameMetrics] so UI-thread
 * CPU phases (animation callbacks, layout, draw) can be separated from
 * RenderThread and GPU time.
 *
 * The Choreographer callback runs once per vsync while the main thread is
 * free, so the gap between two callbacks is the frame interval the user saw:
 * a blocked main thread shows up as one long interval.
 */
internal class FrameRecorder(
  private val activity: Activity?,
  private val displayProvider: () -> Display?,
) : Choreographer.FrameCallback {
  private val intervalsMs = ArrayList<Double>(8192)
  private val expectedMs = ArrayList<Double>(8192)
  private var lastFrameNanos = 0L
  private var startedAtNanos = 0L
  private var running = false

  private val metricsLock = Any()
  private val totalMs = ArrayList<Double>(8192)
  private val phaseSumsNs = LongArray(PHASES.size)
  private var gpuSumNs = 0L
  private var missedDeadline = 0
  private var metricsFrames = 0
  private var metricsThread: HandlerThread? = null
  private var metricsListener: Window.OnFrameMetricsAvailableListener? = null

  fun start() {
    running = true
    startedAtNanos = System.nanoTime()
    lastFrameNanos = 0L
    Choreographer.getInstance().postFrameCallback(this)
    startFrameMetrics()
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

  private fun startFrameMetrics() {
    val window = activity?.window ?: return
    val thread = HandlerThread("perf-lab-frame-metrics").also { it.start() }
    val listener = Window.OnFrameMetricsAvailableListener { _, metrics, _ ->
      if (metrics.getMetric(FrameMetrics.FIRST_DRAW_FRAME) == 1L) {
        return@OnFrameMetricsAvailableListener
      }
      val total = metrics.getMetric(FrameMetrics.TOTAL_DURATION)
      val phases = LongArray(PHASES.size) { metrics.getMetric(PHASES[it]) }
      val gpu = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        metrics.getMetric(FrameMetrics.GPU_DURATION)
      } else {
        0L
      }
      val missed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        total > metrics.getMetric(FrameMetrics.DEADLINE) - metrics.getMetric(FrameMetrics.INTENDED_VSYNC_TIMESTAMP)
      } else {
        false
      }
      synchronized(metricsLock) {
        totalMs.add(total / 1_000_000.0)
        for (index in phases.indices) {
          phaseSumsNs[index] += phases[index]
        }
        gpuSumNs += gpu
        if (missed) {
          missedDeadline += 1
        }
        metricsFrames += 1
      }
    }
    window.addOnFrameMetricsAvailableListener(listener, Handler(thread.looper))
    metricsThread = thread
    metricsListener = listener
  }

  fun stop(): Map<String, Any> {
    running = false
    Choreographer.getInstance().removeFrameCallback(this)
    metricsListener?.let { listener ->
      activity?.window?.removeOnFrameMetricsAvailableListener(listener)
    }
    metricsListener = null
    metricsThread?.quitSafely()
    metricsThread = null

    val android: Map<String, Any> = synchronized(metricsLock) {
      mapOf(
        "frames" to metricsFrames,
        "totalMs" to totalMs.toDoubleArray(),
        "phaseSumsMs" to mapOf(
          "unknownDelay" to phaseSumsNs[0] / 1_000_000.0,
          "inputHandling" to phaseSumsNs[1] / 1_000_000.0,
          "animation" to phaseSumsNs[2] / 1_000_000.0,
          "layoutMeasure" to phaseSumsNs[3] / 1_000_000.0,
          "draw" to phaseSumsNs[4] / 1_000_000.0,
          "sync" to phaseSumsNs[5] / 1_000_000.0,
          "commandIssue" to phaseSumsNs[6] / 1_000_000.0,
          "swapBuffers" to phaseSumsNs[7] / 1_000_000.0,
          "gpu" to gpuSumNs / 1_000_000.0,
          "total" to phaseSumsNs[8] / 1_000_000.0,
        ),
        "missedDeadline" to missedDeadline,
      )
    }

    return mapOf(
      "intervalsMs" to intervalsMs.toDoubleArray(),
      "expectedMs" to expectedMs.toDoubleArray(),
      "durationMs" to (System.nanoTime() - startedAtNanos) / 1_000_000.0,
      "refreshRateHz" to (displayProvider()?.refreshRate ?: 60f).toDouble(),
      "startNs" to startedAtNanos.toDouble(),
      "android" to android,
    )
  }

  companion object {
    private val PHASES = intArrayOf(
      FrameMetrics.UNKNOWN_DELAY_DURATION,
      FrameMetrics.INPUT_HANDLING_DURATION,
      FrameMetrics.ANIMATION_DURATION,
      FrameMetrics.LAYOUT_MEASURE_DURATION,
      FrameMetrics.DRAW_DURATION,
      FrameMetrics.SYNC_DURATION,
      FrameMetrics.COMMAND_ISSUE_DURATION,
      FrameMetrics.SWAP_BUFFERS_DURATION,
      FrameMetrics.TOTAL_DURATION,
    )

    fun emptyRecording(display: Display?): Map<String, Any> = mapOf(
      "intervalsMs" to DoubleArray(0),
      "expectedMs" to DoubleArray(0),
      "durationMs" to 0.0,
      "refreshRateHz" to (display?.refreshRate ?: 60f).toDouble(),
      "startNs" to System.nanoTime().toDouble(),
    )
  }
}
