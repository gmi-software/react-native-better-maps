package com.margelo.nitro.nitromaps

import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

private const val TOLERANCE = 1e-6

/**
 * The bounds under test sit on the equator and span hundredths of a degree, where Mercator y
 * is linear to about a billionth of a degree. Every expected value is therefore
 * `inset / contentWidth * longitudeSpan` degrees, worked out by hand.
 */
class LatLngBoundsEdgePaddingTest {
  @Test
  fun growsOnlyTheEdgeThatWasPadded() {
    val grown =
      requireNotNull(
        bounds().expandedForEdgePadding(
          padding(top = 200.0),
          mapPadding = null,
          viewportWidthPx = 400,
          viewportHeightPx = 800,
        ),
      )

    // 200 px of a 400 px wide box that holds 0.04 degrees of longitude.
    assertEquals(0.03, grown.northeast.latitude, TOLERANCE)
    assertEquals(-0.01, grown.southwest.latitude, TOLERANCE)
    assertEquals(-0.02, grown.southwest.longitude, TOLERANCE)
    assertEquals(0.02, grown.northeast.longitude, TOLERANCE)
  }

  @Test
  fun growsBothEdgesOfAnAxisEvenlyForAUniformPadding() {
    val grown =
      requireNotNull(
        bounds().expandedForEdgePadding(
          padding(top = 50.0, right = 50.0, bottom = 50.0, left = 50.0),
          mapPadding = null,
          viewportWidthPx = 400,
          viewportHeightPx = 800,
        ),
      )

    assertEquals(0.0166667, grown.northeast.latitude, TOLERANCE)
    assertEquals(-0.0166667, grown.southwest.latitude, TOLERANCE)
    assertEquals(0.0266667, grown.northeast.longitude, TOLERANCE)
    assertEquals(-0.0266667, grown.southwest.longitude, TOLERANCE)
  }

  @Test
  fun subtractsTheMapPaddingFromTheViewportWithoutGrowingForIt() {
    val grown =
      requireNotNull(
        bounds().expandedForEdgePadding(
          padding(top = 200.0),
          mapPadding = padding(left = 100.0),
          viewportWidthPx = 400,
          viewportHeightPx = 800,
        ),
      )

    // The map padding leaves 300 px across, so the same 200 px is worth more latitude now.
    assertEquals(0.0366667, grown.northeast.latitude, TOLERANCE)
    assertEquals(-0.02, grown.southwest.longitude, TOLERANCE)
    assertEquals(0.02, grown.northeast.longitude, TOLERANCE)
  }

  @Test
  fun wrapsAWestEdgeGrownPastTheAntimeridian() {
    val grown =
      requireNotNull(
        LatLngBounds(LatLng(-0.01, -179.0), LatLng(0.01, -174.0)).expandedForEdgePadding(
          padding(left = 200.0),
          mapPadding = null,
          viewportWidthPx = 600,
          viewportHeightPx = 800,
        ),
      )

    // -179 minus 2.5 degrees, wrapped back into range.
    assertEquals(178.5, grown.southwest.longitude, TOLERANCE)
    assertEquals(-174.0, grown.northeast.longitude, TOLERANCE)
  }

  @Test
  fun ignoresInsetsAFitCannotUse() {
    val grown =
      requireNotNull(
        bounds().expandedForEdgePadding(
          padding(top = Double.NaN, bottom = 200.0, left = -100.0),
          mapPadding = null,
          viewportWidthPx = 400,
          viewportHeightPx = 800,
        ),
      )

    assertEquals(-0.03, grown.southwest.latitude, TOLERANCE)
    assertEquals(0.01, grown.northeast.latitude, TOLERANCE)
    assertEquals(-0.02, grown.southwest.longitude, TOLERANCE)
  }

  @Test
  fun keepsTheBoundsWhenThereIsNothingToGrowThemBy() {
    assertNull(
      bounds().expandedForEdgePadding(
        padding = null,
        mapPadding = padding(top = 100.0),
        viewportWidthPx = 400,
        viewportHeightPx = 800,
      ),
    )
    assertNull(
      bounds().expandedForEdgePadding(
        padding(),
        mapPadding = null,
        viewportWidthPx = 400,
        viewportHeightPx = 800,
      ),
    )
  }

  @Test
  fun keepsTheBoundsWhenTheInsetsFillTheViewport() {
    assertNull(
      bounds().expandedForEdgePadding(
        padding(right = 200.0, left = 200.0),
        mapPadding = null,
        viewportWidthPx = 400,
        viewportHeightPx = 800,
      ),
    )
    assertNull(
      bounds().expandedForEdgePadding(
        padding(top = 100.0),
        mapPadding = padding(top = 400.0, bottom = 400.0),
        viewportWidthPx = 400,
        viewportHeightPx = 800,
      ),
    )
  }

  @Test
  fun keepsBoundsWithoutAnyExtent() {
    assertNull(
      LatLngBounds(LatLng(1.0, 1.0), LatLng(1.0, 1.0)).expandedForEdgePadding(
        padding(top = 100.0),
        mapPadding = null,
        viewportWidthPx = 400,
        viewportHeightPx = 800,
      ),
    )
  }

  private fun bounds(): LatLngBounds = LatLngBounds(LatLng(-0.01, -0.02), LatLng(0.01, 0.02))

  private fun padding(
    top: Double = 0.0,
    right: Double = 0.0,
    bottom: Double = 0.0,
    left: Double = 0.0,
  ): EdgePadding = EdgePadding(top = top, right = right, bottom = bottom, left = left)
}
