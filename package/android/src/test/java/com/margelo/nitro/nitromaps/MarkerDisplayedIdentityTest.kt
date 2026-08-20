package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerDisplayedIdentityTest {
  @Test
  fun `visual field changes update displayed identity`() {
    val pairs = listOf(
      "image" to (
        marker(image = MarkerImage("asset:/pin.png", 32.0, 32.0, 2.0)) to
          marker(image = MarkerImage("asset:/pin-alt.png", 32.0, 32.0, 2.0))
        ),
      "rotation" to (marker(rotation = 0.0) to marker(rotation = 45.0)),
      "opacity" to (marker(opacity = 1.0) to marker(opacity = 0.4)),
      "anchor" to (
        marker(anchor = MarkerAnchor(0.5, 1.0)) to marker(anchor = MarkerAnchor(0.5, 0.5))
        ),
      "centerOffset" to (
        marker(centerOffset = MarkerPoint(0.0, 0.0)) to
          marker(centerOffset = MarkerPoint(4.0, -8.0))
        ),
      "flat" to (marker(flat = false) to marker(flat = true)),
    )

    for ((field, pair) in pairs) {
      val (before, after) = pair
      assertNotEquals(field, before.displayedIdentityVersion(), after.displayedIdentityVersion())
    }
  }

  @Test
  fun `absent fields are distinguishable from zero valued ones`() {
    assertNotEquals(
      "opacity",
      marker(opacity = null).displayedIdentityVersion(),
      marker(opacity = 0.0).displayedIdentityVersion(),
    )
    assertNotEquals(
      "anchor",
      marker(anchor = null).displayedIdentityVersion(),
      marker(anchor = MarkerAnchor(0.0, 0.0)).displayedIdentityVersion(),
    )
    assertNotEquals(
      "opacity fingerprint",
      arrayOf(marker(opacity = null)).markersFingerprint(),
      arrayOf(marker(opacity = 0.0)).markersFingerprint(),
    )
  }

  @Test
  fun `entering animation change does not update displayed identity`() {
    val before = marker(
      enteringAnimation = OverlayEnteringAnimationDescriptor(
        OverlayEnteringAnimationKind.FADE,
        200.0,
        0.0,
        OverlayEnteringAnimationReduceMotion.SYSTEM,
      ),
    )
    val after = marker(
      enteringAnimation = OverlayEnteringAnimationDescriptor(
        OverlayEnteringAnimationKind.NONE,
        400.0,
        50.0,
        OverlayEnteringAnimationReduceMotion.NEVER,
      ),
    )

    assertEquals(before.displayedIdentityVersion(), after.displayedIdentityVersion())
    assertNotEquals(before.fingerprint(), after.fingerprint())
  }

  @Test
  fun `displayed identity change reaches retained list`() {
    val displayed = ClusterElement.Single(marker(opacity = 1.0))
    val next = ClusterElement.Single(marker(opacity = 0.2))
    val diff = computeMarkerRenderDiff(
      listOf(next),
      mapOf(displayed.diffKey to displayed.renderVersion),
    )

    assertEquals(listOf(next), diff.retained)
  }

  @Test
  fun `entering animation change does not reach retained list`() {
    val displayed = ClusterElement.Single(
      marker(
        enteringAnimation = OverlayEnteringAnimationDescriptor(
          OverlayEnteringAnimationKind.FADE,
          200.0,
          null,
          null,
        ),
      ),
    )
    val next = ClusterElement.Single(
      marker(
        enteringAnimation = OverlayEnteringAnimationDescriptor(
          OverlayEnteringAnimationKind.NONE,
          400.0,
          null,
          null,
        ),
      ),
    )
    val diff = computeMarkerRenderDiff(
      listOf(next),
      mapOf(displayed.diffKey to displayed.renderVersion),
    )

    assertTrue(diff.retained.isEmpty())
    assertTrue(diff.added.isEmpty())
    assertTrue(diff.removedKeys.isEmpty())
  }
}
