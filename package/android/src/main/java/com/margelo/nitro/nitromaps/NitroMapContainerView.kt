package com.margelo.nitro.nitromaps

import android.content.Context
import android.graphics.Point
import android.view.View
import android.view.MotionEvent
import android.view.ViewConfiguration
import com.facebook.react.uimanager.events.NativeGestureUtil
import android.view.ViewGroup

/** Keeps the SDK child out of Fabric's child-index bookkeeping. */
class NitroMapContainerView(context: Context) : ViewGroup(context) {
  var projectCoordinate: ((Coordinate) -> Point?)? = null
  var mapSurface: View? = null
  private val markerViews = mutableListOf<NitroMarkerContentView>()
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var markerDown: MotionEvent? = null
  private var forwardingGesture = false

  init { clipChildren = true }

  fun addMarkerView(child: View, index: Int) {
    require(child is NitroMarkerContentView) { "MapView only accepts native MarkerView children" }
    val nativeChildCount = childCount - markerViews.size
    markerViews.add(index, child)
    addView(child, index + nativeChildCount)
    child.updatePosition()
  }

  fun markerViewAt(index: Int): View = markerViews[index]
  fun markerViewCount(): Int = markerViews.size
  fun removeMarkerViewAt(index: Int) { removeView(markerViews.removeAt(index)) }
  fun removeAllMarkerViews() {
    for (marker in markerViews) removeView(marker)
    markerViews.clear()
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      clearMarkerGesture()
      val touchesMarker = markerViews.any { marker ->
        marker.visibility == VISIBLE && event.x >= marker.x && event.x < marker.x + marker.width &&
          event.y >= marker.y && event.y < marker.y + marker.height
      }
      if (touchesMarker) markerDown = MotionEvent.obtain(event)
    }
    val down = markerDown
    val surface = mapSurface
    if (down != null && surface != null) {
      val dx = event.x - down.x
      val dy = event.y - down.y
      val startsGesture = event.actionMasked == MotionEvent.ACTION_POINTER_DOWN ||
        (event.actionMasked == MotionEvent.ACTION_MOVE && dx * dx + dy * dy > touchSlop * touchSlop)
      if (!forwardingGesture && startsGesture) {
        NativeGestureUtil.notifyNativeGestureStarted(this, event)
        val cancel = MotionEvent.obtain(event)
        cancel.action = MotionEvent.ACTION_CANCEL
        super.dispatchTouchEvent(cancel)
        cancel.recycle()
        surface.dispatchTouchEvent(down)
        forwardingGesture = true
      }
      if (forwardingGesture) {
        surface.dispatchTouchEvent(event)
        if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
          NativeGestureUtil.notifyNativeGestureEnded(this, event)
          clearMarkerGesture()
        }
        return true
      }
    }
    val handled = super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) {
      clearMarkerGesture()
    }
    return handled
  }

  private fun clearMarkerGesture() {
    markerDown?.recycle()
    markerDown = null
    forwardingGesture = false
  }

  override fun onDetachedFromWindow() {
    if (forwardingGesture) {
      markerDown?.let { down ->
        val cancel = MotionEvent.obtain(down)
        cancel.action = MotionEvent.ACTION_CANCEL
        mapSurface?.dispatchTouchEvent(cancel)
        NativeGestureUtil.notifyNativeGestureEnded(this, cancel)
        cancel.recycle()
      }
    }
    clearMarkerGesture()
    super.onDetachedFromWindow()
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
    for (index in 0 until childCount) {
      val child = getChildAt(index)
      if (child !is NitroMarkerContentView) child.measure(widthMeasureSpec, heightMeasureSpec)
    }
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    for (index in 0 until childCount) {
      val child = getChildAt(index)
      if (child !is NitroMarkerContentView) child.layout(0, 0, right - left, bottom - top)
    }
    updateMarkerPositions()
  }

  fun updateMarkerPositions() {
    for (marker in markerViews) marker.updatePosition()
  }
}
