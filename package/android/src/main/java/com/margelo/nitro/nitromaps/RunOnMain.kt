package com.margelo.nitro.nitromaps

import android.os.Handler
import android.os.Looper

private val mainHandler = Handler(Looper.getMainLooper())

/** Runs [block] on the main thread, inline when the caller is already there. */
internal fun runOnMain(block: () -> Unit) {
  if (Looper.myLooper() == Looper.getMainLooper()) {
    block()
    return
  }

  mainHandler.post(block)
}
