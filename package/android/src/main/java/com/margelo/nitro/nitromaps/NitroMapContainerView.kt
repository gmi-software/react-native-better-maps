package com.margelo.nitro.nitromaps

import android.annotation.SuppressLint
import android.content.Context
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import com.facebook.react.uimanager.events.NativeGestureUtil

/**
 * Projects coordinates to pixels in the map view for one pass over the live markers. Built once per
 * camera frame, so every host reuses one projection snapshot.
 */
typealias MarkerProjection = (Coordinate) -> android.graphics.Point?

/**
 * The view `HybridMapView` hands to Fabric: the provider's map view with the live `MarkerView` hosts
 * drawn over it.
 *
 * Fabric only sees the hosts - the patched `HybridMapViewManager` routes its child calls to
 * [addMarkerView] and friends - so the SDK view never shifts Fabric's child indices.
 *
 * A host consumes the touches that start on it, as every React Native view does. A drag or a pinch
 * that starts on one is handed to the map once it moves past the touch slop, unless a view inside the
 * marker - a `ScrollView`, say - claimed it first.
 */
class NitroMapContainerView(
  context: Context,
) : ViewGroup(context) {
  /** Returns the projection for the current camera, or null while there is no map to project with. */
  internal var makeProjection: (() -> MarkerProjection?)? = null
    set(value) {
      field = value
      updateMarkerPositions()
    }

  /** The provider's map view, laid out under the markers. */
  var mapSurface: View? = null

  var scrollGesturesEnabled = true
  var multiTouchGesturesEnabled = true

  private val markerViews = mutableListOf<NitroMarkerContentView>()
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
  private var markerDown: MotionEvent? = null
  private var forwardingGesture = false
  private var descendantOwnsGesture = false

  init {
    clipChildren = true
  }

  val markerViewCount: Int
    get() = markerViews.size

  fun markerViewAt(index: Int): View = markerViews[index]

  fun addMarkerView(
    child: View,
    index: Int,
  ) {
    // Only MarkerView hosts are rendered into a MapView.
    val marker = child as? NitroMarkerContentView ?: return
    val position = index.coerceIn(0, markerViews.size)
    val sdkViewCount = childCount - markerViews.size
    markerViews.add(position, marker)
    addView(marker, sdkViewCount + position)
    marker.updatePosition(makeProjection?.invoke())
  }

  fun removeMarkerViewAt(index: Int) {
    removeView(markerViews.removeAt(index))
  }

  fun removeAllMarkerViews() {
    markerViews.forEach(::removeView)
    markerViews.clear()
  }

  /** Repositions every host for the current camera: one projection, a translation per host that moved. */
  fun updateMarkerPositions() {
    if (markerViews.isEmpty()) {
      return
    }
    val projection = makeProjection?.invoke()
    markerViews.forEach { it.updatePosition(projection) }
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (event.actionMasked == MotionEvent.ACTION_DOWN) {
      clearMarkerGesture()
      if (isOnMarker(event.x, event.y)) {
        markerDown = MotionEvent.obtain(event)
      }
    }

    // A ScrollView in a marker claims its gesture on the first MOVE past its slop, not on DOWN, so
    // the children see each event before the map may take it over.
    val handled = if (forwardingGesture) false else super.dispatchTouchEvent(event)

    val down = markerDown
    val surface = mapSurface
    if (down != null && surface != null) {
      if (!forwardingGesture && !descendantOwnsGesture && startsMapGesture(event, down)) {
        startForwarding(event, down, surface)
      }
      if (forwardingGesture) {
        surface.dispatchTouchEvent(event)
        if (event.isEndOfGesture()) {
          NativeGestureUtil.notifyNativeGestureEnded(this, event)
          clearMarkerGesture()
        }
        return true
      }
    }

    if (event.isEndOfGesture()) {
      clearMarkerGesture()
    }
    return handled
  }

  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
    descendantOwnsGesture = disallowIntercept
    super.requestDisallowInterceptTouchEvent(disallowIntercept)
  }

  override fun onDetachedFromWindow() {
    val down = markerDown
    if (forwardingGesture && down != null) {
      val cancel = MotionEvent.obtain(down)
      cancel.action = MotionEvent.ACTION_CANCEL
      mapSurface?.dispatchTouchEvent(cancel)
      NativeGestureUtil.notifyNativeGestureEnded(this, cancel)
      cancel.recycle()
    }
    clearMarkerGesture()
    super.onDetachedFromWindow()
  }

  override fun onMeasure(
    widthMeasureSpec: Int,
    heightMeasureSpec: Int,
  ) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
    // Fabric measures and lays out the hosts itself.
    for (index in 0 until childCount) {
      val child = getChildAt(index)
      if (child !is NitroMarkerContentView) {
        child.measure(widthMeasureSpec, heightMeasureSpec)
      }
    }
  }

  override fun onLayout(
    changed: Boolean,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    for (index in 0 until childCount) {
      val child = getChildAt(index)
      if (child !is NitroMarkerContentView) {
        child.layout(0, 0, right - left, bottom - top)
      }
    }
    updateMarkerPositions()
  }

  private fun isOnMarker(
    x: Float,
    y: Float,
  ): Boolean =
    markerViews.any { marker ->
      marker.visibility == VISIBLE &&
        x >= marker.x &&
        x < marker.x + marker.width &&
        y >= marker.y &&
        y < marker.y + marker.height
    }

  private fun startsMapGesture(
    event: MotionEvent,
    down: MotionEvent,
  ): Boolean =
    when (event.actionMasked) {
      MotionEvent.ACTION_POINTER_DOWN -> {
        multiTouchGesturesEnabled
      }

      MotionEvent.ACTION_MOVE -> {
        val dx = event.x - down.x
        val dy = event.y - down.y
        scrollGesturesEnabled && dx * dx + dy * dy > touchSlop * touchSlop
      }

      else -> {
        false
      }
    }

  /** Cancels the marker's touches - JS sees its responder terminate - and replays the DOWN to the map. */
  private fun startForwarding(
    event: MotionEvent,
    down: MotionEvent,
    surface: View,
  ) {
    NativeGestureUtil.notifyNativeGestureStarted(this, event)
    val cancel = MotionEvent.obtain(event)
    cancel.action = MotionEvent.ACTION_CANCEL
    super.dispatchTouchEvent(cancel)
    cancel.recycle()
    surface.dispatchTouchEvent(down)
    forwardingGesture = true
  }

  private fun clearMarkerGesture() {
    markerDown?.recycle()
    markerDown = null
    forwardingGesture = false
    descendantOwnsGesture = false
  }

  private fun MotionEvent.isEndOfGesture(): Boolean = actionMasked == MotionEvent.ACTION_UP || actionMasked == MotionEvent.ACTION_CANCEL
}
