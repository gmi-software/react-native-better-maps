package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// ShapeRenderDiffTests.swift checks the same cases on iOS.
class ShapeRenderDiffTest {
  private fun polylines(vararg descriptors: PolylineDescriptor): Map<String, PolylineDescriptor> =
    descriptors.associateByTo(LinkedHashMap()) { it.id }

  private fun shown(next: Map<String, PolylineDescriptor>): Map<String, ShapeRenderVersion> =
    next.mapValues { (_, descriptor) -> descriptor.renderVersion() }

  private fun diff(
    next: Map<String, PolylineDescriptor>,
    displayed: Map<String, ShapeRenderVersion>,
  ) = computeShapeRenderDiff(next, displayed) { it.renderVersion() }

  @Test
  fun `adds every shape of a first update, in descriptor order`() {
    val result = diff(polylines(polylineDescriptor(id = "b"), polylineDescriptor(id = "a")), emptyMap())

    assertEquals(listOf("b", "a"), result.added.map { it.id })
    assertTrue(result.added.all { it.geometryChanged && it.styleChanged })
    assertTrue(result.updated.isEmpty())
    assertTrue(result.removedIds.isEmpty())
  }

  @Test
  fun `removes the shapes that are no longer sent`() {
    val displayed = shown(polylines(polylineDescriptor(id = "kept"), polylineDescriptor(id = "gone")))

    val result = diff(polylines(polylineDescriptor(id = "kept")), displayed)

    assertEquals(setOf("gone"), result.removedIds)
    assertTrue(result.added.isEmpty())
    assertTrue(result.updated.isEmpty())
  }

  @Test
  fun `leaves the shapes alone when the same array is sent again`() {
    val next = polylines(polylineDescriptor(id = "a"), polylineDescriptor(id = "b", coordinates = ROUTE.reversedArray()))

    val result = diff(next, shown(next))

    assertTrue(result.removedIds.isEmpty())
    assertTrue(result.added.isEmpty())
    assertTrue(result.updated.isEmpty())
  }

  @Test
  fun `updates only the live route when one point is appended to it`() {
    val statics =
      (0 until 50).map { index ->
        polylineDescriptor(
          id = "static-$index",
          coordinates = arrayOf(Coordinate(52.0 + index * 0.01, 21.0), Coordinate(52.0 + index * 0.01, 21.1)),
          strokeColor = "#888888",
        )
      }
    val live = polylineDescriptor(id = "live")
    val displayed = shown(polylines(live, *statics.toTypedArray()))

    val appended = polylineDescriptor(id = "live", coordinates = ROUTE + Coordinate(52.24, 21.02))
    val result = diff(polylines(appended, *statics.toTypedArray()), displayed)

    assertEquals(listOf("live"), result.updated.map { it.id })
    assertTrue(result.updated.single().geometryChanged)
    assertFalse(result.updated.single().styleChanged)
    assertTrue(result.added.isEmpty())
    assertTrue(result.removedIds.isEmpty())
  }

  @Test
  fun `restyles without touching the points when only the style changed`() {
    val displayed = shown(polylines(polylineDescriptor(id = "a", strokeColor = "#FF0000")))

    val result = diff(polylines(polylineDescriptor(id = "a", strokeColor = "#00FF00")), displayed)

    val change = result.updated.single()
    assertFalse(change.geometryChanged)
    assertTrue(change.styleChanged)
    assertEquals(polylineDescriptor(strokeColor = "#00FF00").renderVersion(), change.version)
  }

  @Test
  fun `updates both when the points and the style changed`() {
    val displayed = shown(polylines(polylineDescriptor(id = "a")))

    val result =
      diff(polylines(polylineDescriptor(id = "a", coordinates = arrayOf(ROUTE[0]), strokeWidth = 9.0)), displayed)

    val change = result.updated.single()
    assertTrue(change.geometryChanged)
    assertTrue(change.styleChanged)
  }
}
