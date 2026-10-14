package com.margelo.nitro.nitromaps

import android.util.Log

/**
 * Logs, once per prop, that the map was given a prop its provider cannot honour. Such a prop
 * still type-checks and simply has no effect, so without this nothing would tell the developer
 * it was ignored. Silent unless [enabled], which the adapter ties to a debuggable build.
 */
internal class UnsupportedPropWarnings(
  private val enabled: Boolean,
  private val log: (message: String) -> Unit = { Log.w(NITRO_MAPS_LOG_TAG, it) },
) {
  private val warnedProps = HashSet<String>()

  /**
   * Warns the first time [prop] is set to `true`. Absent and `false` are what the provider does
   * anyway, so they never warn.
   */
  fun onSet(
    prop: String,
    value: Boolean?,
    reason: String,
  ) {
    if (enabled && value == true && warnedProps.add(prop)) {
      log("Ignored $prop: $reason")
    }
  }
}
