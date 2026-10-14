package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraAnimationDurationTest {
  @Test
  fun defaultsToAQuarterOfASecond() {
    assertEquals(250, cameraAnimationDurationMs(null))
  }

  @Test
  fun takesMillisecondsAsTheyCome() {
    assertEquals(1000, cameraAnimationDurationMs(1000.0))
    assertEquals(1, cameraAnimationDurationMs(1.0))
  }

  @Test
  fun leavesNothingToAnimateForADurationUnderAMillisecond() {
    assertEquals(0, cameraAnimationDurationMs(0.0))
    assertEquals(0, cameraAnimationDurationMs(0.4))
    assertEquals(0, cameraAnimationDurationMs(Double.NaN))
    assertTrue(cameraAnimationDurationMs(-100.0) <= 0)
  }
}
