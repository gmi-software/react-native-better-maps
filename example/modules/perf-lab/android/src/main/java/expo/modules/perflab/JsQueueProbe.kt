package expo.modules.perflab

import android.os.Handler
import android.os.HandlerThread
import com.facebook.react.bridge.ReactContext

/**
 * Measures JS-thread availability directly: a background thread posts a
 * runnable to React Native's JS message queue every [intervalMs] and records
 * how long it waited before running. While the JS thread is idle the delay
 * is the Looper hand-off (well under a millisecond); a React commit that
 * serializes a marker array shows as one sample of its own length.
 *
 * Unlike `requestAnimationFrame` or `setTimeout` sampling, this does not
 * depend on the UI thread's Choreographer, which React Native on Android
 * uses to dispatch JS timers.
 */
internal class JsQueueProbe(
  private val reactContext: ReactContext,
  private val intervalMs: Long,
) {
  private val thread = HandlerThread("perf-lab-js-queue-probe")
  private lateinit var handler: Handler
  private val lock = Any()
  private val latenessMs = ArrayList<Double>(8192)
  private var startedAtNanos = 0L

  @Volatile
  private var running = false

  fun start() {
    thread.start()
    handler = Handler(thread.looper)
    startedAtNanos = System.nanoTime()
    running = true
    handler.post(::tick)
  }

  private fun tick() {
    if (!running) {
      return
    }
    val posted = System.nanoTime()
    reactContext.runOnJSQueueThread {
      val late = (System.nanoTime() - posted) / 1_000_000.0
      synchronized(lock) {
        latenessMs.add(late)
      }
    }
    handler.postDelayed(::tick, intervalMs)
  }

  fun stop(): Map<String, Any> {
    running = false
    thread.quitSafely()
    return synchronized(lock) {
      mapOf(
        "latenessMs" to latenessMs.toDoubleArray(),
        "samples" to latenessMs.size,
        "intervalMs" to intervalMs.toDouble(),
        "durationMs" to (System.nanoTime() - startedAtNanos) / 1_000_000.0,
      )
    }
  }
}
