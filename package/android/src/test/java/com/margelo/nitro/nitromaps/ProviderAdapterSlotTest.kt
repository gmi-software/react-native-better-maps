package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.fail
import org.junit.Test

// ProviderAdapterSlotTests.swift checks the same cases on iOS.

class ProviderAdapterSlotTest {
  private class FakeAdapter(
    val configuration: String,
  )

  private val events = mutableListOf<String>()
  private val failingBuilds = mutableSetOf<String>()

  private val slot =
    ProviderAdapterSlot<String, FakeAdapter>(
      build = { configuration ->
        if (configuration in failingBuilds) {
          throw IllegalStateException("cannot build $configuration")
        }
        events += "build $configuration"
        FakeAdapter(configuration)
      },
      destroy = { adapter -> events += "destroy ${adapter.configuration}" },
    )

  @Test
  fun buildsTheFirstAdapterFromTheCommittedConfiguration() {
    val built = slot.commit("google map-id")

    assertEquals("google map-id", built?.configuration)
    assertSame(built, slot.adapter)
    assertEquals(listOf("build google map-id"), events)
  }

  @Test
  fun keepsTheAdapterWhenTheConfigurationIsUnchanged() {
    val built = slot.commit("google map-id")

    assertNull(slot.commit("google map-id"))
    assertSame(built, slot.adapter)
    assertEquals(listOf("build google map-id"), events)
  }

  @Test
  fun destroysTheCurrentAdapterBeforeBuildingTheNext() {
    slot.commit("google map-a")
    val rebuilt = slot.commit("google map-b")

    assertEquals("google map-b", rebuilt?.configuration)
    assertSame(rebuilt, slot.adapter)
    assertEquals(listOf("build google map-a", "destroy google map-a", "build google map-b"), events)
  }

  @Test
  fun buildsAgainAfterARelease() {
    slot.commit("google map-id")
    slot.release()

    assertNull(slot.adapter)
    assertEquals("google map-id", slot.commit("google map-id")?.configuration)
    assertEquals(listOf("build google map-id", "destroy google map-id", "build google map-id"), events)
  }

  @Test
  fun releasesNothingWhenThereIsNoAdapter() {
    slot.release()

    assertNull(slot.adapter)
    assertEquals(emptyList<String>(), events)
  }

  @Test
  fun leavesNoAdapterWhenABuildThrowsAndRetriesOnTheNextCommit() {
    slot.commit("google map-a")
    failingBuilds += "google map-b"

    try {
      slot.commit("google map-b")
      fail("The build was expected to throw.")
    } catch (expected: IllegalStateException) {
      assertEquals("cannot build google map-b", expected.message)
    }
    assertNull(slot.adapter)

    failingBuilds.clear()
    assertEquals("google map-b", slot.commit("google map-b")?.configuration)
    assertEquals(listOf("build google map-a", "destroy google map-a", "build google map-b"), events)
  }
}
