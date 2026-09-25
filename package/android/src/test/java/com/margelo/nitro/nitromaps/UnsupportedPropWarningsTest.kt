package com.margelo.nitro.nitromaps

import org.junit.Assert.assertEquals
import org.junit.Test

class UnsupportedPropWarningsTest {
  private val messages = mutableListOf<String>()

  private fun warnings(enabled: Boolean = true) = UnsupportedPropWarnings(enabled) { messages.add(it) }

  @Test
  fun warnsOnceHoweverOftenThePropIsSet() {
    val warnings = warnings()

    warnings.onSet("showsScale", true, "no scale control.")
    warnings.onSet("showsScale", true, "no scale control.")
    warnings.onSet("showsScale", false, "no scale control.")
    warnings.onSet("showsScale", true, "no scale control.")

    assertEquals(listOf("Ignored showsScale: no scale control."), messages)
  }

  @Test
  fun staysSilentWhileThePropIsAbsentOrFalse() {
    val warnings = warnings()

    warnings.onSet("showsScale", null, "no scale control.")
    warnings.onSet("showsScale", false, "no scale control.")

    assertEquals(emptyList<String>(), messages)
  }

  @Test
  fun warnsOnceForEachProp() {
    val warnings = warnings()

    warnings.onSet("followsUserLocation", true, "no follow mode.")
    warnings.onSet("showsScale", true, "no scale control.")
    warnings.onSet("followsUserLocation", true, "no follow mode.")

    assertEquals(
      listOf("Ignored followsUserLocation: no follow mode.", "Ignored showsScale: no scale control."),
      messages,
    )
  }

  @Test
  fun staysSilentWhenDisabled() {
    val warnings = warnings(enabled = false)

    warnings.onSet("showsScale", true, "no scale control.")

    assertEquals(emptyList<String>(), messages)
  }
}
