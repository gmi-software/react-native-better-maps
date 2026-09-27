package com.margelo.nitro.nitromaps

import com.google.android.gms.location.Priority
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UserLocationRequestTest {
  @Test
  fun asksForGpsWithPreciseLocation() {
    assertEquals(
      Priority.PRIORITY_HIGH_ACCURACY,
      userLocationPriority(hasFineLocation = true, hasCoarseLocation = true),
    )
    // An app that declares only ACCESS_FINE_LOCATION holds it without the coarse one.
    assertEquals(
      Priority.PRIORITY_HIGH_ACCURACY,
      userLocationPriority(hasFineLocation = true, hasCoarseLocation = false),
    )
  }

  @Test
  fun settlesForBalancedAccuracyWithApproximateLocation() {
    assertEquals(
      Priority.PRIORITY_BALANCED_POWER_ACCURACY,
      userLocationPriority(hasFineLocation = false, hasCoarseLocation = true),
    )
  }

  @Test
  fun asksForNothingWithoutPermission() {
    assertNull(userLocationPriority(hasFineLocation = false, hasCoarseLocation = false))
  }

  @Test
  fun makesTheRequestTheSdksOwnSourceMakes() {
    val request = userLocationRequest(Priority.PRIORITY_HIGH_ACCURACY)

    assertEquals(Priority.PRIORITY_HIGH_ACCURACY, request.priority)
    assertEquals(5_000L, request.intervalMillis)
    assertEquals(16L, request.minUpdateIntervalMillis)
    assertTrue(request.isWaitForAccurateLocation)
  }
}
