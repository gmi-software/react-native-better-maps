package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CameraValidityTest {
  @Test
  fun acceptsACameraTheSdkCanRepresent() {
    assertTrue(camera().isValid())
    assertTrue(camera(latitude = -90.0, longitude = 180.0).isValid())
  }

  @Test
  fun acceptsACameraThatSuppliesNoFramingValues() {
    assertTrue(camera(zoom = null, heading = null, pitch = null, altitude = null).isValid())
  }

  @Test
  fun rejectsANonFiniteCenter() {
    assertFalse(camera(latitude = Double.NaN, longitude = Double.NaN).isValid())
    assertFalse(camera(longitude = Double.POSITIVE_INFINITY).isValid())
  }

  @Test
  fun rejectsACenterOutsideTheWorld() {
    assertFalse(camera(latitude = 1000.0).isValid())
    assertFalse(camera(longitude = -180.0001).isValid())
  }

  @Test
  fun rejectsANonFiniteFramingValue() {
    assertFalse(camera(zoom = Double.NaN).isValid())
    assertFalse(camera(heading = Double.POSITIVE_INFINITY).isValid())
    assertFalse(camera(pitch = Double.NaN).isValid())
    assertFalse(camera(altitude = Double.NEGATIVE_INFINITY).isValid())
  }

  /** A pitch past the drawable range is clamped rather than rejected, so the camera still applies. */
  @Test
  fun acceptsAPitchOutsideTheDrawableRange() {
    assertTrue(camera(pitch = 120.0).isValid())
    assertTrue(camera(pitch = -10.0).isValid())
  }

  /**
   * `CameraPosition.Builder.tilt` throws `IllegalArgumentException` for anything outside 0..90, so
   * the clamp is what keeps a valid camera with an unsupported pitch from taking the mount
   * transaction down.
   */
  @Test
  fun clampsAPitchTheSdkWouldRefuse() {
    assertEquals(90.0f, camera(pitch = 120.0).toCameraPosition().tilt, 0.0f)
    assertEquals(0.0f, camera(pitch = -10.0).toCameraPosition().tilt, 0.0f)
    assertEquals(45.0f, camera(pitch = 45.0).toCameraPosition().tilt, 0.0f)
  }

  private fun camera(
    latitude: Double = 52.23,
    longitude: Double = 21.01,
    zoom: Double? = 12.0,
    heading: Double? = 90.0,
    pitch: Double? = 45.0,
    altitude: Double? = 1000.0,
  ): Camera =
    Camera(
      center = Coordinate(latitude = latitude, longitude = longitude),
      zoom = zoom,
      heading = heading,
      pitch = pitch,
      altitude = altitude,
    )
}
