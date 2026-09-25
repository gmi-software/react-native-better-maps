package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Drives [RegionChangeTracker] with the callback sequences the Google Maps SDK was
 * seen to produce on an emulator, with an integer standing in for the camera position.
 * `package/ios/Tests/Camera/RegionChangeTrackerTests.swift` runs the same cases.
 */
class RegionChangeTrackerTest {
  private var position = 0
  private val events = mutableListOf<String>()

  private val tracker =
    RegionChangeTracker(
      position = { position },
      region = { regionAt(position) },
      onBegin = { region, details -> events += event("begin", region, details) },
      onComplete = { region, details -> events += event("complete", region, details) },
    )

  /** A map that has settled into its first position, as every case but one assumes. */
  private fun settle() {
    tracker.cameraStopped()
  }

  @Test
  fun anAnimationEmitsOneBeginAndOneComplete() {
    settle()
    tracker.moveStarted(isGesture = false)
    position = 1
    tracker.cameraMoved()
    position = 2
    tracker.cameraMoved()
    tracker.cameraStopped()

    assertEquals(listOf("begin app @0", "complete app @2"), events)
  }

  @Test
  fun aJumpWithNoMoveCallbackStillEmitsBothEvents() {
    settle()
    tracker.moveStarted(isGesture = false)
    position = 5
    tracker.cameraStopped()

    assertEquals(listOf("begin app @0", "complete app @5"), events)
  }

  @Test
  fun measuresAMoveFromWhereTheCameraLastCameToRest() {
    // MapKit already reports the destination when the app sets the camera.
    settle()
    position = 4
    tracker.moveStarted(isGesture = false)
    tracker.cameraStopped()

    assertEquals(listOf("begin app @0", "complete app @4"), events)
  }

  @Test
  fun anUpdateThatLeavesTheCameraInPlaceEmitsNothing() {
    // A repeated fit, or a `region` prop sent again with the same values.
    settle()
    tracker.moveStarted(isGesture = false)
    tracker.cameraMoved()
    tracker.cameraStopped()

    assertEquals(emptyList<String>(), events)
  }

  @Test
  fun theMapSettlingIntoItsFirstPositionEmitsNothing() {
    tracker.moveStarted(isGesture = false)
    position = 7
    tracker.cameraMoved()
    tracker.cameraStopped()
    assertEquals(emptyList<String>(), events)

    // From there on, moves are measured against it.
    tracker.moveStarted(isGesture = false)
    position = 8
    tracker.cameraStopped()
    assertEquals(listOf("begin app @7", "complete app @8"), events)
  }

  @Test
  fun aSecondStartForTheSameMoveIsIgnored() {
    // One animation interrupting another: the SDK does not go idle in between.
    settle()
    tracker.moveStarted(isGesture = false)
    position = 1
    tracker.cameraMoved()
    tracker.moveStarted(isGesture = false)
    position = 2
    tracker.cameraMoved()
    tracker.cameraStopped()

    assertEquals(listOf("begin app @0", "complete app @2"), events)
  }

  @Test
  fun aGestureTakingOverEndsTheAppsMoveAndStartsItsOwn() {
    settle()
    tracker.moveStarted(isGesture = false)
    position = 1
    tracker.cameraMoved()
    tracker.moveStarted(isGesture = true)
    position = 2
    tracker.cameraMoved()
    tracker.cameraStopped()

    assertEquals(
      listOf("begin app @0", "complete app @1", "begin gesture @1", "complete gesture @2"),
      events,
    )
  }

  @Test
  fun aGestureTakingOverBeforeTheCameraMovedLeavesOnlyTheGesture() {
    settle()
    tracker.moveStarted(isGesture = false)
    tracker.moveStarted(isGesture = true)
    position = 3
    tracker.cameraMoved()
    tracker.cameraStopped()

    assertEquals(listOf("begin gesture @0", "complete gesture @3"), events)
  }

  @Test
  fun theAppTakingOverFromAGestureStaysOneGestureMove() {
    settle()
    tracker.moveStarted(isGesture = true)
    position = 1
    tracker.cameraMoved()
    tracker.moveStarted(isGesture = false)
    position = 2
    tracker.cameraMoved()
    tracker.cameraStopped()

    assertEquals(listOf("begin gesture @0", "complete gesture @2"), events)
  }

  @Test
  fun reportsAGestureOnlyWhileOneIsUnderWay() {
    settle()
    assertFalse(tracker.isGesture)

    tracker.moveStarted(isGesture = true)
    assertTrue(tracker.isGesture)

    tracker.cameraStopped()
    assertFalse(tracker.isGesture)

    tracker.moveStarted(isGesture = false)
    assertFalse(tracker.isGesture)
  }

  @Test
  fun ignoresStepsOutsideAMove() {
    settle()
    position = 1
    tracker.cameraMoved()

    assertEquals(emptyList<String>(), events)
  }

  private fun event(
    kind: String,
    region: Region,
    details: RegionChangeDetails,
  ): String {
    val source = if (details.isGesture) "gesture" else "app"
    return "$kind $source @${region.latitude.toInt()}"
  }

  private fun regionAt(position: Int): Region =
    Region(
      latitude = position.toDouble(),
      longitude = 0.0,
      latitudeDelta = 1.0,
      longitudeDelta = 1.0,
    )
}
