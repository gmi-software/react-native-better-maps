package com.margelo.nitro.nitromaps

import android.os.Trace

/**
 * Wraps [block] in a systrace section so the marker pipeline shows up in
 * Perfetto and Android Studio's system trace. A no-op when tracing is off.
 */
internal inline fun <T> traceSection(name: String, block: () -> T): T {
  Trace.beginSection(name)
  try {
    return block()
  } finally {
    Trace.endSection()
  }
}
