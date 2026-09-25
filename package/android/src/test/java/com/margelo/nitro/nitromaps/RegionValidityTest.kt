package com.margelo.nitro.nitromaps

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RegionValidityTest {
  @Test
  fun acceptsARegionLatLngBoundsCanRepresent() {
    assertTrue(region().isValid())
    assertTrue(
      region(latitude = 0.0, longitude = 180.0, latitudeDelta = 180.0, longitudeDelta = 360.0)
        .isValid(),
    )
  }

  @Test
  fun rejectsANonFiniteRegion() {
    assertFalse(region(latitude = Double.NaN, longitude = Double.NaN).isValid())
    assertFalse(region(latitudeDelta = Double.NaN).isValid())
    assertFalse(region(longitudeDelta = Double.POSITIVE_INFINITY).isValid())
  }

  @Test
  fun rejectsACenterOutsideTheWorld() {
    assertFalse(region(latitude = 1000.0).isValid())
    assertFalse(region(longitude = -180.0001).isValid())
  }

  @Test
  fun rejectsASpanThatCoversNoArea() {
    assertFalse(region(latitudeDelta = 0.0).isValid())
    assertFalse(region(longitudeDelta = 0.0).isValid())
    assertFalse(region(latitudeDelta = -0.1).isValid())
    assertFalse(region(longitudeDelta = -0.1).isValid())
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
