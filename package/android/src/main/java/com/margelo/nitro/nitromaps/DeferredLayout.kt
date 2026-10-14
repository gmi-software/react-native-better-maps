package com.margelo.nitro.nitromaps

import android.view.View
import android.view.ViewTreeObserver

/**
 * Runs work that needs [view] to have a size, holding it back until a layout
 * pass gives it one: `newLatLngBounds` throws on a map view that has not been
 * laid out yet.
 *
 * [release] cancels whatever is still waiting. A view torn down before its
 * first layout pass never gets one, so without it that work would wait forever,
 * along with any promise it was going to settle.
 *
 * The layout listener is registered only while [view] is attached to a window,
 * and on that window's observer. A detached view hands out a stand-in observer
 * instead, so a listener left behind when the view leaves its window - which
 * React Native does before it drops the view - could no longer be taken off,
 * and would keep the destroyed map alive for as long as the window lives.
 *
 * Main thread only, like the view it waits on.
 */
internal class DeferredLayout(
  private val view: View,
) {
  private class Entry(
    val block: () -> Unit,
    val onCancel: () -> Unit,
  )

  private val waiting = mutableListOf<Entry>()
  private var isReleased = false

  /** The window observer [layoutListener] is registered on, while it is. */
  private var registeredOn: ViewTreeObserver? = null

  private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener { runIfLaidOut() }

  private val attachListener =
    object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(v: View) {
        startListening()
      }

      override fun onViewDetachedFromWindow(v: View) {
        stopListening()
      }
    }

  init {
    view.addOnAttachStateChangeListener(attachListener)
  }

  /**
   * Runs [block] now if [view] already has a size, otherwise in the first
   * layout pass that gives it one. [onCancel] runs instead if [release] comes
   * first, and straight away once it has.
   */
  fun run(
    onCancel: () -> Unit = {},
    block: () -> Unit,
  ) {
    if (isReleased) {
      onCancel()
      return
    }

    if (hasSize()) {
      block()
      return
    }

    waiting += Entry(block, onCancel)
    startListening()
  }

  /** Stops listening for good and cancels everything still waiting, in call order. */
  fun release() {
    if (isReleased) {
      return
    }

    isReleased = true
    stopListening()
    view.removeOnAttachStateChangeListener(attachListener)
    for (entry in drain()) {
      entry.onCancel()
    }
  }

  private fun runIfLaidOut() {
    if (!hasSize()) {
      return
    }

    stopListening()
    for (entry in drain()) {
      entry.block()
    }
  }

  private fun startListening() {
    if (registeredOn != null || waiting.isEmpty() || !view.isAttachedToWindow) {
      return
    }

    val observer = view.viewTreeObserver
    observer.addOnGlobalLayoutListener(layoutListener)
    registeredOn = observer
  }

  private fun stopListening() {
    val observer = registeredOn ?: return
    registeredOn = null
    // A window being torn down kills its observer, and the listener goes with it.
    if (observer.isAlive) {
      observer.removeOnGlobalLayoutListener(layoutListener)
    }
  }

  private fun drain(): List<Entry> {
    val drained = waiting.toList()
    waiting.clear()
    return drained
  }

  private fun hasSize(): Boolean = view.width > 0 && view.height > 0
}
