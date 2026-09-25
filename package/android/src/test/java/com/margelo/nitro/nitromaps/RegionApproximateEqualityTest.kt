package com.margelo.nitro.nitromaps

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * `applyRegion` compares the requested region against the one the map already shows, so
 * a consumer that echoes `onRegionChangeComplete` back into the `region` prop does not
 * start a re-fit loop. These pin down what "already shows it" means.
 */
class RegionApproximateEqualityTest {
  @Test
  fun acceptsTheSameRegion() {
    assertTrue(region().approximatelyEquals(region()))
  }

  @Test
  fun acceptsADifferenceBelowTheEpsilon() {
    assertTrue(region().approximatelyEquals(region(latitude = 52.23 + 1e-9)))
    assertTrue(region().approximatelyEquals(region(longitudeDelta = 0.1 + 1e-9)))
  }

  @Test
  fun rejectsAMovedCenter() {
    assertFalse(region().approximatelyEquals(region(latitude = 52.24)))
    assertFalse(region().approximatelyEquals(region(longitude = 21.02)))
  }

  @Test
  fun rejectsAResizedSpan() {
    assertFalse(region().approximatelyEquals(region(latitudeDelta = 0.2)))
    assertFalse(region().approximatelyEquals(region(longitudeDelta = 0.2)))
  }

  private fun region(
    latitude: Double = 52.23,
    longitude: Double = 21.01,
    latitudeDelta: Double = 0.1,
    longitudeDelta: Double = 0.1,
  ): Region =
    Region(
      latitude = latitude,
      longitude = longitude,
      latitudeDelta = latitudeDelta,
      longitudeDelta = longitudeDelta,
    )
}
