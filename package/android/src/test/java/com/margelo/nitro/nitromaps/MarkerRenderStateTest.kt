package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MarkerRenderStateTest {
  @Test
  fun `markers delivered before a map are not drawn`() {
    val state = MarkerRenderState()

    assertFalse(state.setMarkers(arrayOf(marker(id = "a"))))
  }

  @Test
  fun `an attaching map draws the markers delivered before it`() {
    val state = MarkerRenderState()
    val markers = arrayOf(marker(id = "a"))
    state.setMarkers(markers)

    assertTrue(state.attachMap())
    assertEquals(listOf("a"), state.descriptors.map { it.id })
  }

  @Test
  fun `redelivering the markers an attaching map already drew changes nothing`() {
    val state = MarkerRenderState()
    val markers = arrayOf(marker(id = "a"))
    state.setMarkers(markers)
    state.attachMap()

    assertFalse(state.setMarkers(markers))
  }

  @Test
  fun `clustering flipped before a map does not swallow those markers`() {
    val state = MarkerRenderState()
    val markers = arrayOf(marker(id = "a"), marker(id = "b"))
    state.setMarkers(markers)

    // What the unguarded clustering setter used to do: redeliver, map or no map.
    assertFalse(state.setClusteringEnabled(true))
    assertFalse(state.setMarkers(markers))

    assertTrue(state.attachMap())
  }

  @Test
  fun `attaching a map without markers draws nothing`() {
    val state = MarkerRenderState()

    assertFalse(state.attachMap())
  }

  @Test
  fun `a map attached without markers does not redraw on an empty delivery`() {
    val state = MarkerRenderState()
    state.attachMap()

    assertFalse(state.setMarkers(null))
    assertFalse(state.setMarkers(emptyArray()))
  }

  @Test
  fun `markers cleared before a map are not drawn once it arrives`() {
    val state = MarkerRenderState()
    state.setMarkers(arrayOf(marker(id = "a")))

    assertFalse(state.setMarkers(null))
    assertFalse(state.attachMap())
  }

  @Test
  fun `changed markers are redrawn while a map is attached`() {
    val state = MarkerRenderState()
    state.attachMap()
    state.setMarkers(arrayOf(marker(id = "a")))

    assertTrue(state.setMarkers(arrayOf(marker(id = "a"), marker(id = "b"))))
  }

  @Test
  fun `unchanged markers are not redrawn while a map is attached`() {
    val state = MarkerRenderState()
    state.attachMap()
    state.setMarkers(arrayOf(marker(id = "a")))

    assertFalse(state.setMarkers(arrayOf(marker(id = "a"))))
  }

  @Test
  fun `clustering changes redraw only while a map is attached`() {
    val state = MarkerRenderState()
    state.setMarkers(arrayOf(marker(id = "a")))

    assertFalse(state.setClusteringEnabled(true))

    state.attachMap()

    assertFalse(state.setClusteringEnabled(true))
    assertTrue(state.setClusteringEnabled(false))
  }

  @Test
  fun `a map that goes away stops markers from being drawn`() {
    val state = MarkerRenderState()
    state.attachMap()
    state.setMarkers(arrayOf(marker(id = "a")))

    state.detachMap()

    assertFalse(state.setMarkers(arrayOf(marker(id = "b"))))
  }

  @Test
  fun `reset forgets the markers`() {
    val state = MarkerRenderState()
    val markers = arrayOf(marker(id = "a"))
    state.attachMap()
    state.setMarkers(markers)

    state.reset()

    assertTrue(state.descriptors.isEmpty())
    assertTrue(state.setMarkers(markers))
  }

  @Test
  fun `clustering drives the viewport pipeline for small datasets`() {
    val state = MarkerRenderState()
    state.setMarkers(arrayOf(marker(id = "a")))

    assertFalse(state.usesViewportPipeline)

    state.setClusteringEnabled(true)

    assertTrue(state.usesViewportPipeline)
  }

  @Test
  fun `large datasets use the viewport pipeline without clustering`() {
    val state = MarkerRenderState()

    state.setMarkers(Array(500) { marker(id = "m$it") })

    assertFalse(state.usesViewportPipeline)

    state.setMarkers(Array(501) { marker(id = "m$it") })

    assertTrue(state.usesViewportPipeline)
  }
}
