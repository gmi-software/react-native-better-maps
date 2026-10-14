package com.margelo.nitro.nitromaps

import android.app.Activity
import android.content.Context
import android.graphics.Point
import android.view.MotionEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.ScrollView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MarkerViewGestureTest {
  private val context: Context = RuntimeEnvironment.getApplication()

  /** Stands in for the Google map view and records what reaches it. */
  private class Surface(
    context: Context,
  ) : View(context) {
    val actions = mutableListOf<Int>()

    override fun onTouchEvent(event: MotionEvent): Boolean {
      actions.add(event.actionMasked)
      return true
    }
  }

  private class RecordingView(
    context: Context,
  ) : View(context) {
    val actions = mutableListOf<Int>()

    override fun onTouchEvent(event: MotionEvent): Boolean {
      actions.add(event.actionMasked)
      return true
    }
  }

  /** A 100 px marker at (150, 150) in a 400 px map, holding [child]. */
  private fun fixture(child: View): Pair<NitroMapContainerView, Surface> {
    val map = NitroMapContainerView(context)
    val surface = Surface(context)
    map.addView(surface)
    map.mapSurface = surface
    map.makeProjection = { { Point(150, 150) } }
    map.layout(0, 0, 400, 400)
    val marker = NitroMarkerContentView(context)
    marker.coordinate = Coordinate(0.0, 0.0)
    marker.anchor = MarkerAnchor(0.0, 0.0)
    marker.addView(child)
    val exactly100 = View.MeasureSpec.makeMeasureSpec(100, View.MeasureSpec.EXACTLY)
    child.measure(exactly100, exactly100)
    child.layout(0, 0, 100, 100)
    marker.layout(0, 0, 100, 100)
    map.addMarkerView(marker, 0)
    return map to surface
  }

  private fun send(
    map: NitroMapContainerView,
    action: Int,
    y: Float,
    time: Long,
  ) {
    val event = MotionEvent.obtain(0, time, action, 175f, y, 0)
    map.dispatchTouchEvent(event)
    event.recycle()
  }

  @Test
  fun `a ScrollView in the marker keeps the drag it claimed`() {
    val scroll = ScrollView(context)
    // A ScrollView measures its content unconstrained, where a plain View is only as tall as its minimum.
    scroll.addView(View(context).apply { minimumHeight = 1000 }, FrameLayout.LayoutParams(100, 1000))
    val (map, surface) = fixture(scroll)

    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 185f, 20)
    send(map, MotionEvent.ACTION_MOVE, 165f, 40)
    send(map, MotionEvent.ACTION_UP, 165f, 60)

    assertTrue("the map must not see a drag the marker owns", surface.actions.isEmpty())
    assertTrue("the ScrollView scrolls instead of being cancelled", scroll.scrollY > 0)
  }

  @Test
  fun `a drag that starts on a marker pans the map and cancels the marker`() {
    val child = RecordingView(context)
    val (map, surface) = fixture(child)

    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 185f, 20)
    send(map, MotionEvent.ACTION_UP, 185f, 40)

    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_CANCEL), child.actions)
    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP), surface.actions)
  }

  @Test
  fun `a tap stays with the marker`() {
    val child = RecordingView(context)
    val (map, surface) = fixture(child)

    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 236f, 10)
    send(map, MotionEvent.ACTION_UP, 236f, 20)

    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP), child.actions)
    assertTrue(surface.actions.isEmpty())
  }

  @Test
  fun `with map scrolling disabled a drag stays with the marker`() {
    val child = RecordingView(context)
    val (map, surface) = fixture(child)
    map.scrollGesturesEnabled = false

    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_MOVE, 185f, 20)
    send(map, MotionEvent.ACTION_UP, 185f, 40)

    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP), child.actions)
    assertTrue(surface.actions.isEmpty())
  }

  @Test
  fun `a marker off screen is invisible and takes no touches`() {
    val child = RecordingView(context)
    val (map, surface) = fixture(child)
    map.makeProjection = { { Point(900, 900) } }

    send(map, MotionEvent.ACTION_DOWN, 235f, 0)
    send(map, MotionEvent.ACTION_UP, 235f, 10)

    assertEquals(View.INVISIBLE, map.markerViewAt(0).visibility)
    assertTrue(child.actions.isEmpty())
    assertEquals(listOf(MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP), surface.actions)
  }

  @Test
  fun `the marker content follows the projection after the map moves on screen`() {
    val child = View(context)
    val (map, _) = fixture(child)
    val marker = map.markerViewAt(0) as NitroMarkerContentView
    child.layout(12, 8, 84, 36)
    val activity = Robolectric.buildActivity(Activity::class.java).setup().get()
    activity.setContentView(map)
    map.layout(40, 60, 440, 460)

    fun assertChildAt(
      projectedX: Int,
      projectedY: Int,
    ) {
      val mapOnScreen = IntArray(2)
      val childOnScreen = IntArray(2)
      map.getLocationOnScreen(mapOnScreen)
      child.getLocationOnScreen(childOnScreen)
      assertEquals(projectedX + 12, childOnScreen[0] - mapOnScreen[0])
      assertEquals(projectedY + 8, childOnScreen[1] - mapOnScreen[1])
    }

    assertChildAt(150, 150)
    marker.anchor = MarkerAnchor(0.5, 1.0)
    map.makeProjection = { { Point(250, 280) } }
    assertChildAt(200, 180)
  }
}
