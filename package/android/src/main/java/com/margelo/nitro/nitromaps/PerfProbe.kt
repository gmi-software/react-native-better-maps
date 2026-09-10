package com.margelo.nitro.nitromaps

import android.os.Looper
import android.os.Trace
import org.json.JSONArray
import org.json.JSONObject

/**
 * Timing probes around the overlay pipeline, used by the performance lab
 * (see performance/README.md).
 *
 * [ENABLED] mirrors `BuildConfig.PERF_PROBES`, a `static final` constant that
 * the library's `build.gradle` sets from the `NitroMaps_perfProbes` Gradle
 * property. When it is false every probe reduces to one constant check that
 * ART folds away; the recording code is never reached and nothing is
 * allocated. When it is true each span is recorded and also emitted as an
 * `android.os.Trace` section (prefix `NitroMaps.`) for Perfetto and the
 * Android Studio profiler.
 */
internal object PerfProbe {
  @JvmField
  val ENABLED: Boolean = BuildConfig.PERF_PROBES

  class Token(@JvmField val name: String, @JvmField val startNs: Long)

  private class Span(
    val name: String,
    val startNs: Long,
    val durationNs: Long,
    val count: Int,
    val thread: String,
  )

  /** Spans kept per drain; anything beyond this is counted as dropped. */
  private const val CAPACITY = 50_000
  private val spans = ArrayList<Span>(1024)
  private var dropped = 0

  @Volatile
  var isRecording: Boolean = true

  @JvmStatic
  fun begin(name: String): Token? {
    if (!ENABLED) {
      return null
    }
    Trace.beginSection("NitroMaps.$name")
    return Token(name, System.nanoTime())
  }

  @JvmStatic
  fun end(token: Token?, count: Int = 0) {
    if (token == null) {
      return
    }
    val endNs = System.nanoTime()
    Trace.endSection()
    if (!isRecording) {
      return
    }
    val thread = if (Looper.myLooper() == Looper.getMainLooper()) "main" else "background"
    synchronized(this) {
      if (spans.size >= CAPACITY) {
        dropped += 1
      } else {
        spans.add(Span(token.name, token.startNs, endNs - token.startNs, count, thread))
      }
    }
  }

  inline fun <T> measure(name: String, count: Int = 0, block: () -> T): T {
    if (!ENABLED) {
      return block()
    }
    val token = begin(name)
    try {
      return block()
    } finally {
      end(token, count)
    }
  }

  @JvmStatic
  fun coordinateCount(polylines: Array<PolylineDescriptor>?): Int =
    polylines?.sumOf { it.coordinates.size } ?: 0

  @JvmStatic
  fun coordinateCount(polygons: Array<PolygonDescriptor>?): Int =
    polygons?.sumOf { it.coordinates.size } ?: 0

  /**
   * Drains every recorded span as JSON:
   * `{"spans":[{"name","startNs","durationNs","count","thread"}],"dropped":n}`.
   */
  @JvmStatic
  fun drainJson(): String {
    val drained: List<Span>
    val droppedCount: Int
    synchronized(this) {
      drained = ArrayList(spans)
      spans.clear()
      droppedCount = dropped
      dropped = 0
    }
    val array = JSONArray()
    for (span in drained) {
      array.put(
        JSONObject()
          .put("name", span.name)
          .put("startNs", span.startNs)
          .put("durationNs", span.durationNs)
          .put("count", span.count)
          .put("thread", span.thread),
      )
    }
    return JSONObject().put("spans", array).put("dropped", droppedCount).toString()
  }
}

/**
 * Public, reflection-friendly entry point for the performance lab's native
 * module, which looks it up by name so it never depends on this library's
 * Gradle module directly. Present in every build; only reports data when
 * the probes were compiled in.
 */
object NitroMapsPerfProbeBridge {
  @JvmStatic
  fun isAvailable(): Boolean = PerfProbe.ENABLED

  @JvmStatic
  fun setEnabled(enabled: Boolean) {
    PerfProbe.isRecording = enabled
  }

  @JvmStatic
  fun drainJson(): String = PerfProbe.drainJson()

  /** `System.nanoTime()`, the clock the spans and `Choreographer` use. */
  @JvmStatic
  fun nowNanos(): Long = System.nanoTime()
}
