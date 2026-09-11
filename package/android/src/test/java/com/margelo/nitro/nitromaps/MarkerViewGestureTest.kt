package com.margelo.nitro.nitromaps

import android.content.Context
import android.graphics.Point
import android.view.MotionEvent
import android.view.View
import android.widget.ScrollView
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MarkerViewGestureTest {
  private val context: Context = RuntimeEnvironment.getApplication()

  private class Surface(context: Context) : View(context) {
    val actions = mutableListOf<Int>()
    override fun onTouchEvent(event: MotionEvent): Boolean {
      actions.add(event.actionMasked)
      return true
    }
  }

  private fun fixture(child: View): Pair<NitroMapContainerView, Surface> {
    val map = NitroMapContainerView(context)
    val surface = Surface(context)
    map.addView(surface)
    map.mapSurface = surface
    map.projectCoordinate = { Point(150, 150) }
    map.layout(0, 0, 400, 400)
    val marker = NitroMarkerContentView(context)
    marker.coordinate = Coordinate(0.0, 0.0)
    marker.anchor = MarkerAnchor(0.0, 0.0)
    marker.addView(child)
    child.measure(View.MeasureSpec.makeMeasureSpec(100, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(100, View.MeasureSpec.EXACTLY))
    child.layout(0, 0, 100, 100)
    marker.layout(0, 0, 100, 100)
    map.addMarkerView(marker, 0)
    return Pair(map, surface)
  }

  private fun send(map: NitroMapContainerView, action: Int, y: Float, time: Long) {
    val event = MotionEvent.obtain(0, time, action, 175f, y, 0)
    map.dispatchTouchEvent(event)
    event.recycle()
  }

  @Test fun scrollViewClaimsThresholdCrossingMoveBeforeMapHandoff() {
    val scroll = ScrollView(context)
    scroll.addView(View(context).apply { minimumHeight = 1000 }, android.widget.FrameLayout.LayoutParams(100, 1000))
    val (map, surface) = fixture(scroll)
    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 185f, 20)
    send(map, MotionEvent.ACTION_MOVE, 165f, 40)
    send(map, MotionEvent.ACTION_UP, 165f, 60)
    assertTrue("SDK must not see the owned gesture", surface.actions.isEmpty())
    assertTrue("The child scrolls instead of receiving CANCEL (viewport=${scroll.height}, content=${scroll.getChildAt(0).height}, scrollY=${scroll.scrollY})", scroll.scrollY > 0)
  }

  @Test fun unclaimedDragReplaysDownToMapAndCancelsChild() {
    val childActions = mutableListOf<Int>()
    val child = object : View(context) {
      override fun onTouchEvent(event: MotionEvent): Boolean {
        childActions.add(event.actionMasked)
        return true
      }
    }
    val (map, surface) = fixture(child)
    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 185f, 20)
    send(map, MotionEvent.ACTION_UP, 185f, 40)
    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_CANCEL), childActions)
    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP), surface.actions)
  }

  @Test fun disabledMapScrollPreservesChildSequence() {
    val childActions = mutableListOf<Int>()
    val child = object : View(context) {
      override fun onTouchEvent(event: MotionEvent): Boolean {
        childActions.add(event.actionMasked)
        return true
      }
    }
    val (map, surface) = fixture(child)
    map.scrollGesturesEnabled = false
    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 185f, 20)
    send(map, MotionEvent.ACTION_UP, 185f, 40)
    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP), childActions)
    assertTrue(surface.actions.isEmpty())
  }
}
