package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerRenderDiffTest {
  @Test
  fun `new keys are added`() {
    val first = ClusterElement.Single(marker(id = "a"))
    val second = ClusterElement.Single(marker(id = "b"))
    val diff = computeMarkerRenderDiff(listOf(first, second), emptyMap())

    assertEquals(emptySet<String>(), diff.removedKeys)
    assertEquals(listOf(first, second), diff.added)
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `missing keys are removed`() {
    val kept = ClusterElement.Single(marker(id = "a"))
    val diff = computeMarkerRenderDiff(
      listOf(kept),
      mapOf("s:a" to kept.renderVersion, "s:gone" to 9L),
    )

    assertEquals(setOf("s:gone"), diff.removedKeys)
    assertTrue(diff.added.isEmpty())
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `version change marks retained`() {
    val displayed = ClusterElement.Single(marker(id = "a", opacity = 1.0))
    val next = ClusterElement.Single(marker(id = "a", opacity = 0.2))
    val diff = computeMarkerRenderDiff(
      listOf(next),
      mapOf(displayed.diffKey to displayed.renderVersion),
    )

    assertTrue(diff.removedKeys.isEmpty())
    assertTrue(diff.added.isEmpty())
    assertEquals(listOf(next), diff.retained)
  }

  @Test
  fun `unchanged version is skipped`() {
    val element = ClusterElement.Single(marker(id = "a"))
    val diff = computeMarkerRenderDiff(
      listOf(element),
      mapOf(element.diffKey to element.renderVersion),
    )

    assertTrue(diff.removedKeys.isEmpty())
    assertTrue(diff.added.isEmpty())
    assertTrue(diff.retained.isEmpty())
  }

  @Test
  fun `duplicate keys keep the first element`() {
    val first = ClusterElement.Single(marker(id = "a", opacity = 1.0))
    val duplicate = ClusterElement.Single(marker(id = "a", opacity = 0.1))
    val diff = computeMarkerRenderDiff(listOf(first, duplicate), emptyMap())

    assertEquals(listOf(first), diff.added)
  }
}
