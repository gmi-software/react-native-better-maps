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

/**
 * Runs [block] on the main thread as a new message, even when the caller is already there, so
 * it lands behind whatever the main thread is running now.
 */
internal fun postOnMain(block: () -> Unit) {
  mainHandler.post(block)
}
